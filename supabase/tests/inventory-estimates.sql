-- Phase 7A inventory, pricing and capacity access rules. Fictional temporary
-- accounts only; every change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  worker_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  truck_id uuid;
  req_id uuid;
  sofa_id uuid;
  retired_id uuid;
  new_item uuid;
  saved integer;
  checks integer := 0;
  as_user text := 'request.jwt.claims';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (other_id,other_id::text||'@example.invalid','{}'),
    (worker_id,worker_id::text||'@example.invalid','{}'),
    (admin_id,admin_id::text||'@example.invalid','{}');
  update public.profiles set role='worker' where id=worker_id;
  update public.profiles set role='admin' where id=admin_id;
  insert into public.trucks(name) values ('Inventory test truck') returning id into truck_id;
  select id into sofa_id from public.inventory_catalog where name='Sofa, 3-seat' and room='Living room';
  if sofa_id is null then raise exception 'Starter catalog missing'; end if;
  insert into public.inventory_catalog(name,room,cubic_feet,weight_lb,active)
    values ('Retired test item','Other',9,90,false) returning id into retired_id;

  if exists (select 1 from pg_class where oid in ('public.inventory_catalog'::regclass,'public.request_items'::regclass,'public.pricing_settings'::regclass) and not relrowsecurity)
    then raise exception 'RLS disabled'; end if;
  if (select public.inventory_capabilities()) <> 7 then raise exception 'Capability missing'; end if;
  checks := checks + 2;

  set local role authenticated;
  -- Clients have read-only table access; every write goes through checked functions.
  if has_table_privilege('authenticated','public.inventory_catalog','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.request_items','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.pricing_settings','INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','public.request_items','SELECT')
     or has_function_privilege('anon','public.set_request_items(uuid,integer,jsonb)','EXECUTE')
    then raise exception 'Unexpected grant'; end if;
  checks := checks + 1;

  -- Customer: active catalog only, no pricing.
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  if not exists (select 1 from public.inventory_catalog where id=sofa_id) then raise exception 'Customer cannot read catalog'; end if;
  if exists (select 1 from public.inventory_catalog where id=retired_id) then raise exception 'Customer sees inactive item'; end if;
  if exists (select 1 from public.pricing_settings) then raise exception 'Customer reads pricing'; end if;
  checks := checks + 3;

  insert into public.move_requests(pickup,destination,requested_date,property_type,move_size,items,access_details)
    values('12 Example Lane','25 Example Court',(now() at time zone 'America/Chicago')::date+7,'House','2 bedrooms','See inventory','None')
    returning id into req_id;

  -- Catalog lines copy catalog sizes, ignoring client-sent sizes and names.
  saved := public.set_request_items(req_id,1,jsonb_build_array(
    jsonb_build_object('catalogId',sofa_id,'quantity',2,'label','Fake','cubicFeet',1),
    jsonb_build_object('label','  Antique trunk ','room','Other','quantity',1,'cubicFeet',12.34,'weightLb',80)));
  if saved <> 2 then raise exception 'Expected two lines'; end if;
  if not exists (select 1 from public.request_items where request_id=req_id and position=1 and label='Sofa, 3-seat' and cubic_feet=50 and weight_lb=350 and quantity=2 and catalog_id=sofa_id)
    then raise exception 'Catalog snapshot incorrect'; end if;
  if not exists (select 1 from public.request_items where request_id=req_id and position=2 and label='Antique trunk' and cubic_feet=12.3 and catalog_id is null)
    then raise exception 'Custom line incorrect'; end if;
  checks := checks + 3;
  -- Replacing is idempotent: a retry leaves exactly the same lines.
  saved := public.set_request_items(req_id,1,jsonb_build_array(jsonb_build_object('catalogId',sofa_id,'quantity',2)));
  if saved <> 1 or (select count(*) from public.request_items where request_id=req_id) <> 1 then raise exception 'Replace failed'; end if;
  checks := checks + 1;

  begin perform public.set_request_items(req_id,2,'[]'); raise exception 'Stale revision accepted';
  exception when sqlstate '40001' then checks := checks + 1; end;
  begin perform public.set_request_items(req_id,1,jsonb_build_array(jsonb_build_object('catalogId',retired_id,'quantity',1)));
    raise exception 'Inactive catalog item accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.set_request_items(req_id,1,jsonb_build_array(jsonb_build_object('catalogId',sofa_id,'quantity',0)));
    raise exception 'Zero quantity accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.set_request_items(req_id,1,jsonb_build_array(jsonb_build_object('catalogId',sofa_id,'quantity',1.5)));
    raise exception 'Fractional quantity accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.set_request_items(req_id,1,jsonb_build_array(jsonb_build_object('label','Huge','room','Other','quantity',1,'cubicFeet',201,'weightLb',1)));
    raise exception 'Oversized custom item accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.set_request_items(req_id,1,jsonb_build_array(jsonb_build_object('label','Box','room','Attic','quantity',1,'cubicFeet',3,'weightLb',1)));
    raise exception 'Unknown room accepted';
  exception when check_violation then checks := checks + 1; end;
  begin perform public.set_request_items(req_id,1,(select jsonb_agg(jsonb_build_object('catalogId',sofa_id,'quantity',1)) from generate_series(1,61)));
    raise exception 'Too many lines accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  -- A failed call leaves the earlier saved list unchanged.
  if (select count(*) from public.request_items where request_id=req_id) <> 1 then raise exception 'Failed call changed lines'; end if;
  checks := checks + 1;

  begin perform public.save_inventory_item(null,'Customer item','Other',1,1,true); raise exception 'Customer edited catalog';
  exception when sqlstate '42501' then checks := checks + 1; end;
  begin perform public.save_pricing_settings(1,1,10,1,1,10,1,30); raise exception 'Customer edited pricing';
  exception when sqlstate '42501' then checks := checks + 1; end;
  begin perform public.set_truck_capacity(truck_id,800); raise exception 'Customer edited capacity';
  exception when sqlstate '42501' then checks := checks + 1; end;

  -- Another customer and an unassigned worker cannot read or replace the list.
  perform set_config(as_user,json_build_object('sub',other_id,'role','authenticated')::text,true);
  if exists (select 1 from public.request_items where request_id=req_id) then raise exception 'Other customer reads inventory'; end if;
  begin perform public.set_request_items(req_id,1,'[]'); raise exception 'Other customer replaced inventory';
  exception when sqlstate '42501' then checks := checks + 2; end;
  perform set_config(as_user,json_build_object('sub',worker_id,'role','authenticated')::text,true);
  if exists (select 1 from public.request_items where request_id=req_id) then raise exception 'Worker reads inventory'; end if;
  begin perform public.save_inventory_item(null,'Worker item','Other',1,1,true); raise exception 'Worker edited catalog';
  exception when sqlstate '42501' then checks := checks + 2; end;

  -- Administrator: reads everything and manages catalog, pricing and capacity.
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  if (select count(*) from public.request_items where request_id=req_id) <> 1
     or not exists (select 1 from public.inventory_catalog where id=retired_id)
     or (select count(*) from public.pricing_settings) <> 1 then raise exception 'Administrator reads failed'; end if;
  checks := checks + 1;
  new_item := public.save_inventory_item(null,' Test cabinet ','Office',14.5,120,true);
  if not exists (select 1 from public.inventory_catalog where id=new_item and name='Test cabinet') then raise exception 'Add failed'; end if;
  begin perform public.save_inventory_item(null,'TEST CABINET','Office',1,1,true); raise exception 'Duplicate name accepted';
  exception when sqlstate '22023' then checks := checks + 2; end;
  -- Editing the catalog never changes inventories already saved on requests.
  perform public.save_inventory_item(sofa_id,'Sofa, 3-seat','Living room',99,999,true);
  if (select cubic_feet from public.request_items where request_id=req_id) <> 50 then raise exception 'Snapshot changed'; end if;
  checks := checks + 1;
  begin perform public.save_pricing_settings(4500,12500,40,2,200,35,3,30); raise exception 'Bad road factor accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  perform public.save_pricing_settings(5000,10000,45,2.5,150,40,1.25,30);
  if not exists (select 1 from public.pricing_settings where worker_hourly_cents=5000 and road_factor=1.25 and updated_by=admin_id) then raise exception 'Pricing not saved'; end if;
  checks := checks + 1;
  begin perform public.set_truck_capacity(truck_id,10); raise exception 'Tiny capacity accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  perform public.set_truck_capacity(truck_id,800);
  if (select capacity_cubic_feet from public.trucks where id=truck_id) <> 800 then raise exception 'Capacity not saved'; end if;
  perform public.set_truck_capacity(truck_id,null);
  if (select capacity_cubic_feet from public.trucks where id=truck_id) is not null then raise exception 'Capacity not cleared'; end if;
  checks := checks + 2;
  begin perform public.set_request_items(req_id,1,'[]'); raise exception 'Administrator replaced customer inventory';
  exception when sqlstate '42501' then checks := checks + 1; end;

  -- After publication the customer can no longer change the inventory.
  reset role;
  insert into public.estimates(request_id,status,terms,created_by,published_at,total_cents)
    values (req_id,'awaiting','Test terms',admin_id,now(),10000);
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  begin perform public.set_request_items(req_id,1,'[]'); raise exception 'Edited after publication';
  exception when sqlstate '40001' then checks := checks + 1; end;

  -- Deactivated accounts cannot read or write inventory.
  reset role;
  update public.profiles set active=false where id=owner_id;
  set local role authenticated;
  if exists (select 1 from public.request_items where request_id=req_id) then raise exception 'Inactive owner reads inventory'; end if;
  begin perform public.set_request_items(req_id,1,'[]'); raise exception 'Inactive owner wrote inventory';
  exception when sqlstate '42501' then checks := checks + 2; end;

  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('inventory-estimates assertions completed');
select * from finish();
rollback;
