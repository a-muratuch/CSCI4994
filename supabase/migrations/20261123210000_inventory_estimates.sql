-- Phase 7A: inventory-based estimate suggestions. Additive only.
-- Apply to the hosted project only after owner approval.
-- Catalog sizes are generic industry-style approximations, not a quote.
begin;

-- Inventory catalog: administrator-managed reference sizes.
create table public.inventory_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100 and name = trim(name)),
  room text not null check (room in ('Living room','Bedroom','Kitchen & dining','Office','Garage & outdoor','Boxes','Other')),
  cubic_feet numeric(6,1) not null check (cubic_feet > 0 and cubic_feet <= 500),
  weight_lb integer not null check (weight_lb between 0 and 3000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index inventory_catalog_room_name on public.inventory_catalog (room, lower(name));

-- Request inventory. Sizes are copied from the catalog when saved, so later
-- catalog edits never change an existing request.
create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.move_requests(id) on delete cascade,
  position integer not null check (position between 1 and 60),
  catalog_id uuid references public.inventory_catalog(id) on delete set null,
  label text not null check (char_length(label) between 1 and 100),
  room text not null check (room in ('Living room','Bedroom','Kitchen & dining','Office','Garage & outdoor','Boxes','Other')),
  quantity integer not null check (quantity between 1 and 99),
  cubic_feet numeric(6,1) not null check (cubic_feet > 0 and cubic_feet <= 500),
  weight_lb integer not null check (weight_lb between 0 and 3000),
  unique (request_id, position)
);

-- One row of pricing inputs used only for suggestions; estimates stay editable.
create table public.pricing_settings (
  id boolean primary key default true check (id),
  worker_hourly_cents integer not null check (worker_hourly_cents between 100 and 100000),
  truck_fee_cents integer not null check (truck_fee_cents between 0 and 1000000),
  cubic_feet_per_worker_hour integer not null check (cubic_feet_per_worker_hour between 5 and 500),
  minimum_hours numeric(3,1) not null check (minimum_hours between 1 and 12),
  per_mile_cents integer not null check (per_mile_cents between 0 and 10000),
  travel_mph integer not null check (travel_mph between 10 and 80),
  road_factor numeric(3,2) not null check (road_factor between 1 and 2),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.pricing_settings(worker_hourly_cents,truck_fee_cents,cubic_feet_per_worker_hour,minimum_hours,per_mile_cents,travel_mph,road_factor)
values (4500,12500,40,2.0,200,35,1.20);

alter table public.trucks add column capacity_cubic_feet integer check (capacity_cubic_feet between 50 and 5000);

-- Row-level security. Writes happen only through the checked functions below.
alter table public.inventory_catalog enable row level security;
alter table public.request_items enable row level security;
alter table public.pricing_settings enable row level security;
create policy active_account_required on public.inventory_catalog as restrictive for all to authenticated
  using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.request_items as restrictive for all to authenticated
  using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.pricing_settings as restrictive for all to authenticated
  using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy "Signed-in accounts read the catalog" on public.inventory_catalog for select to authenticated
  using (active or (select rebel_move_private.is_admin()));
create policy "Owners and administrators read request inventory" on public.request_items for select to authenticated
  using ((select rebel_move_private.is_admin()) or exists (
    select 1 from public.move_requests r where r.id = request_items.request_id and r.customer_id = (select auth.uid())));
create policy "Administrators read pricing settings" on public.pricing_settings for select to authenticated
  using ((select rebel_move_private.is_admin()));
revoke all on public.inventory_catalog, public.request_items, public.pricing_settings from public, anon, authenticated;
grant select on public.inventory_catalog, public.request_items, public.pricing_settings to authenticated;

-- Customer: replace a pending request's inventory. Idempotent, so retries are safe.
create function rebel_move_private.set_request_items(p_request_id uuid, p_revision integer, p_items jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare saved public.move_requests%rowtype; item jsonb; catalog public.inventory_catalog%rowtype; n integer := 0;
  v_label text; v_room text; v_cubic numeric; v_weight integer; v_quantity integer; v_catalog uuid;
begin
  perform rebel_move_private.require_active_account();
  select * into saved from public.move_requests where id = p_request_id for update;
  if not found or saved.customer_id is distinct from auth.uid() then
    raise exception 'Request unavailable' using errcode = '42501'; end if;
  if saved.revision is distinct from p_revision or saved.status <> 'pending'
     or exists (select 1 from public.estimates where request_id = p_request_id and published_at is not null) then
    raise exception 'Request changed or estimate published' using errcode = '40001'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 60 then
    raise exception 'Use up to 60 inventory lines' using errcode = '22023'; end if;
  delete from public.request_items where request_id = p_request_id;
  for item in select value from jsonb_array_elements(p_items) loop
    n := n + 1;
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'quantity') is distinct from 'number' then
      raise exception 'Invalid inventory line' using errcode = '22023'; end if;
    v_quantity := (item->>'quantity')::numeric;
    if v_quantity::numeric <> (item->>'quantity')::numeric or v_quantity not between 1 and 99 then
      raise exception 'Quantity must be 1 to 99' using errcode = '22023'; end if;
    if jsonb_typeof(item->'catalogId') = 'string' then
      select * into catalog from public.inventory_catalog
        where id = (case when (item->>'catalogId') ~* '^[0-9a-f-]{36}$' then (item->>'catalogId')::uuid end) and active;
      if not found then raise exception 'Catalog item unavailable' using errcode = '22023'; end if;
      v_catalog := catalog.id; v_label := catalog.name; v_room := catalog.room;
      v_cubic := catalog.cubic_feet; v_weight := catalog.weight_lb;
    else
      if jsonb_typeof(item->'label') is distinct from 'string' or jsonb_typeof(item->'room') is distinct from 'string'
         or jsonb_typeof(item->'cubicFeet') is distinct from 'number' or jsonb_typeof(item->'weightLb') is distinct from 'number' then
        raise exception 'Invalid custom item' using errcode = '22023'; end if;
      v_catalog := null; v_label := trim(item->>'label'); v_room := item->>'room';
      v_cubic := round((item->>'cubicFeet')::numeric, 1); v_weight := round((item->>'weightLb')::numeric);
      if char_length(v_label) not between 1 and 100 or v_cubic not between 0.5 and 200 or v_weight not between 0 and 1000 then
        raise exception 'Custom item outside limits' using errcode = '22023'; end if;
    end if;
    insert into public.request_items(request_id, position, catalog_id, label, room, quantity, cubic_feet, weight_lb)
    values (p_request_id, n, v_catalog, v_label, v_room, v_quantity, v_cubic, v_weight);
  end loop;
  return n;
end $$;

-- Administrator: add or edit a catalog item.
create function rebel_move_private.save_inventory_item(p_id uuid, p_name text, p_room text, p_cubic_feet numeric, p_weight_lb integer, p_active boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_active is null then raise exception 'Invalid item' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.inventory_catalog(name, room, cubic_feet, weight_lb, active)
    values (trim(p_name), p_room, p_cubic_feet, p_weight_lb, p_active) returning id into saved;
  else
    update public.inventory_catalog set name = trim(p_name), room = p_room, cubic_feet = p_cubic_feet,
      weight_lb = p_weight_lb, active = p_active, updated_at = now() where id = p_id returning id into saved;
    if saved is null then raise exception 'Item unavailable' using errcode = '22023'; end if;
  end if;
  return saved;
exception when unique_violation or check_violation or not_null_violation then
  raise exception 'Check the item name, room and sizes' using errcode = '22023';
end $$;

-- Administrator: update pricing inputs.
create function rebel_move_private.save_pricing_settings(p_worker_hourly_cents integer, p_truck_fee_cents integer,
  p_cubic_feet_per_worker_hour integer, p_minimum_hours numeric, p_per_mile_cents integer, p_travel_mph integer, p_road_factor numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  update public.pricing_settings set worker_hourly_cents = p_worker_hourly_cents, truck_fee_cents = p_truck_fee_cents,
    cubic_feet_per_worker_hour = p_cubic_feet_per_worker_hour, minimum_hours = p_minimum_hours,
    per_mile_cents = p_per_mile_cents, travel_mph = p_travel_mph, road_factor = p_road_factor,
    updated_at = now(), updated_by = auth.uid() where id;
exception when check_violation or not_null_violation then
  raise exception 'Pricing values are outside the allowed ranges' using errcode = '22023';
end $$;

-- Administrator: set or clear a truck's cargo capacity.
create function rebel_move_private.set_truck_capacity(p_id uuid, p_capacity integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  update public.trucks set capacity_cubic_feet = p_capacity where id = p_id;
  if not found then raise exception 'Truck unavailable' using errcode = '22023'; end if;
exception when check_violation then
  raise exception 'Capacity must be 50 to 5,000 cubic feet' using errcode = '22023';
end $$;

-- Exposed invoker wrappers, matching earlier phases.
create function public.set_request_items(p_request_id uuid, p_revision integer, p_items jsonb) returns integer
language sql security invoker set search_path='' as $$ select rebel_move_private.set_request_items(p_request_id, p_revision, p_items); $$;
create function public.save_inventory_item(p_id uuid, p_name text, p_room text, p_cubic_feet numeric, p_weight_lb integer, p_active boolean) returns uuid
language sql security invoker set search_path='' as $$ select rebel_move_private.save_inventory_item(p_id, p_name, p_room, p_cubic_feet, p_weight_lb, p_active); $$;
create function public.save_pricing_settings(p_worker_hourly_cents integer, p_truck_fee_cents integer,
  p_cubic_feet_per_worker_hour integer, p_minimum_hours numeric, p_per_mile_cents integer, p_travel_mph integer, p_road_factor numeric) returns void
language sql security invoker set search_path='' as $$ select rebel_move_private.save_pricing_settings(p_worker_hourly_cents, p_truck_fee_cents,
  p_cubic_feet_per_worker_hour, p_minimum_hours, p_per_mile_cents, p_travel_mph, p_road_factor); $$;
create function public.set_truck_capacity(p_id uuid, p_capacity integer) returns void
language sql security invoker set search_path='' as $$ select rebel_move_private.set_truck_capacity(p_id, p_capacity); $$;
create function public.inventory_capabilities() returns integer language sql stable security invoker set search_path='' as $$ select 7; $$;

revoke all on function rebel_move_private.set_request_items(uuid,integer,jsonb), public.set_request_items(uuid,integer,jsonb),
  rebel_move_private.save_inventory_item(uuid,text,text,numeric,integer,boolean), public.save_inventory_item(uuid,text,text,numeric,integer,boolean),
  rebel_move_private.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric), public.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric),
  rebel_move_private.set_truck_capacity(uuid,integer), public.set_truck_capacity(uuid,integer),
  public.inventory_capabilities() from public, anon, authenticated;
grant execute on function rebel_move_private.set_request_items(uuid,integer,jsonb), public.set_request_items(uuid,integer,jsonb),
  rebel_move_private.save_inventory_item(uuid,text,text,numeric,integer,boolean), public.save_inventory_item(uuid,text,text,numeric,integer,boolean),
  rebel_move_private.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric), public.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric),
  rebel_move_private.set_truck_capacity(uuid,integer), public.set_truck_capacity(uuid,integer),
  public.inventory_capabilities() to authenticated;

-- Starter catalog: common household items with approximate sizes.
insert into public.inventory_catalog(name, room, cubic_feet, weight_lb) values
  ('Sofa, 3-seat','Living room',50,350),('Loveseat','Living room',35,245),('Armchair','Living room',20,140),
  ('Recliner','Living room',25,175),('Coffee table','Living room',8,55),('End table','Living room',4,30),
  ('TV, flat screen','Living room',10,50),('TV stand','Living room',12,85),('Bookcase, large','Living room',20,140),
  ('Rug, large','Living room',8,55),
  ('Bed, king (with frame)','Bedroom',70,490),('Bed, queen (with frame)','Bedroom',60,420),('Bed, twin (with frame)','Bedroom',35,245),
  ('Dresser','Bedroom',35,245),('Nightstand','Bedroom',5,35),('Wardrobe','Bedroom',40,280),('Crib','Bedroom',12,85),
  ('Dining table','Kitchen & dining',30,210),('Dining chair','Kitchen & dining',5,35),('Refrigerator','Kitchen & dining',45,300),
  ('Microwave','Kitchen & dining',3,40),('China cabinet','Kitchen & dining',40,280),('Bar stool','Kitchen & dining',3,20),
  ('Desk','Office',25,175),('Office chair','Office',8,40),('Filing cabinet, 4-drawer','Office',12,120),('Computer and monitor','Office',4,40),
  ('Washer','Garage & outdoor',25,175),('Dryer','Garage & outdoor',25,150),('Lawn mower','Garage & outdoor',15,100),
  ('Bicycle','Garage & outdoor',10,35),('Patio table','Garage & outdoor',20,100),('Grill','Garage & outdoor',15,120),
  ('Box, small','Boxes',1.5,20),('Box, medium','Boxes',3,30),('Box, large','Boxes',4.5,40),('Wardrobe box','Boxes',10,60),
  ('Piano, upright','Other',70,600),('Treadmill','Other',30,250),('Mirror, large','Other',6,40);

commit;
