-- Applies after the four manually created foundation tables.
-- Database RPCs only; the frontend remains on its in-memory provider.

begin;

create schema rebel_move_private;
revoke all on schema rebel_move_private from public, anon, authenticated;
grant usage on schema rebel_move_private to authenticated;

alter table public.estimates add column total_cents bigint
  check (total_cents is null or total_cents between 1 and 999999999);

create table public.estimate_events (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id),
  actor_id uuid not null references public.profiles(id),
  previous_status text not null check (previous_status in ('draft', 'awaiting')),
  new_status text not null check (new_status in ('awaiting', 'accepted', 'declined')),
  occurred_at timestamptz not null default now()
);
create index estimate_events_estimate_id_idx on public.estimate_events(estimate_id);
create index estimate_events_actor_id_idx on public.estimate_events(actor_id);
alter table public.estimate_events enable row level security;
revoke all on public.estimate_events from anon, authenticated;
grant select on public.estimate_events to authenticated;
create policy "Read events for accessible estimates"
on public.estimate_events for select to authenticated
using (exists (
  select 1 from public.estimates where id = estimate_events.estimate_id
));

-- Internal trigger serializes pricing inserts with publication.
create function rebel_move_private.guard_pricing_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare current_status text;
begin
  select status into current_status from public.estimates
    where id = new.estimate_id for update;
  if not found or current_status <> 'draft' then
    raise exception 'Pricing can only be added to a draft estimate.' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function rebel_move_private.guard_pricing_insert() from public, anon, authenticated;
create trigger guard_pricing_insert before insert on public.estimate_items
for each row execute function rebel_move_private.guard_pricing_insert();

create function rebel_move_private.publish_estimate(p_estimate_id uuid)
returns public.estimates language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  estimate_record public.estimates%rowtype;
  line_count bigint;
  price bigint;
begin
  if actor is null or not exists (
    select 1 from public.profiles where id = actor and role = 'admin'
  ) then
    raise exception 'Only administrators can publish estimates.' using errcode = '42501';
  end if;
  select * into estimate_record from public.estimates
    where id = p_estimate_id for update;
  if not found or estimate_record.status <> 'draft' then
    raise exception 'A draft estimate is required.' using errcode = '22023';
  end if;
  select count(*), coalesce(sum(amount_cents), 0) into line_count, price
    from public.estimate_items where estimate_id = p_estimate_id;
  if line_count not between 1 and 20 or price not between 1 and 999999999 then
    raise exception 'Provide 1–20 pricing lines and a positive total up to $9,999,999.99.'
      using errcode = '22023';
  end if;
  if cardinality(estimate_record.inclusions) not between 1 and 20
    or cardinality(estimate_record.exclusions) not between 1 and 20
    or exists (
      select 1 from unnest(estimate_record.inclusions || estimate_record.exclusions) as item(value)
      where value is null or char_length(trim(value)) not between 1 and 500
    ) then
    raise exception 'Provide valid inclusions and exclusions; write None if applicable.'
      using errcode = '22023';
  end if;
  update public.estimates set status = 'awaiting', published_at = now(), total_cents = price
    where id = p_estimate_id returning * into estimate_record;
  insert into public.estimate_events(estimate_id, actor_id, previous_status, new_status)
    values (p_estimate_id, actor, 'draft', 'awaiting');
  return estimate_record;
end;
$$;
revoke all on function rebel_move_private.publish_estimate(uuid) from public, anon, authenticated;
grant execute on function rebel_move_private.publish_estimate(uuid) to authenticated;

create function rebel_move_private.decide_estimate(p_estimate_id uuid, p_decision text)
returns public.estimates language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  estimate_record public.estimates%rowtype;
begin
  if actor is null or not exists (
    select 1 from public.profiles where id = actor and role = 'customer'
  ) then
    raise exception 'Only the owning customer can decide an estimate.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('accepted', 'declined') then
    raise exception 'Choose accepted or declined.' using errcode = '22023';
  end if;
  select * into estimate_record from public.estimates
    where id = p_estimate_id for update;
  if not found or not exists (
    select 1 from public.move_requests
    where id = estimate_record.request_id and customer_id = actor
  ) then
    raise exception 'This estimate is not available to this customer.' using errcode = '42501';
  end if;
  if estimate_record.status <> 'awaiting' then
    raise exception 'Only an estimate awaiting a decision can be accepted or declined.'
      using errcode = '22023';
  end if;
  update public.estimates set status = p_decision, decided_at = now()
    where id = p_estimate_id returning * into estimate_record;
  insert into public.estimate_events(estimate_id, actor_id, previous_status, new_status)
    values (p_estimate_id, actor, 'awaiting', p_decision);
  return estimate_record;
end;
$$;
revoke all on function rebel_move_private.decide_estimate(uuid, text) from public, anon, authenticated;
grant execute on function rebel_move_private.decide_estimate(uuid, text) to authenticated;

-- Exposed wrappers run as the caller; privileged implementations are private.
create function public.publish_estimate(p_estimate_id uuid)
returns public.estimates language sql security invoker set search_path = ''
as $$ select rebel_move_private.publish_estimate(p_estimate_id); $$;
revoke all on function public.publish_estimate(uuid) from public, anon, authenticated;
grant execute on function public.publish_estimate(uuid) to authenticated;

create function public.decide_estimate(p_estimate_id uuid, p_decision text)
returns public.estimates language sql security invoker set search_path = ''
as $$ select rebel_move_private.decide_estimate(p_estimate_id, p_decision); $$;
revoke all on function public.decide_estimate(uuid, text) from public, anon, authenticated;
grant execute on function public.decide_estimate(uuid, text) to authenticated;
create index estimates_created_by_idx on public.estimates(created_by);

commit;
