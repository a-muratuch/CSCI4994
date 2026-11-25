-- Phase 7B: scheduling suggestions with travel-time checks. Additive only and
-- depends on Phase 7A (inventory_estimates). Apply to the hosted project only
-- after owner approval. save_job is unchanged; travel time is checked by the
-- application because ZIP distances come from the application's ZIP data.
begin;

-- Minutes a crew needs between jobs besides driving (paperwork, break, fuel).
alter table public.pricing_settings
  add column turnaround_minutes integer not null default 30 check (turnaround_minutes between 0 and 180);

-- Replace the 7A pricing function so administrators can edit the buffer too.
drop function public.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric);
drop function rebel_move_private.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric);
create function rebel_move_private.save_pricing_settings(p_worker_hourly_cents integer, p_truck_fee_cents integer,
  p_cubic_feet_per_worker_hour integer, p_minimum_hours numeric, p_per_mile_cents integer, p_travel_mph integer,
  p_road_factor numeric, p_turnaround_minutes integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  update public.pricing_settings set worker_hourly_cents = p_worker_hourly_cents, truck_fee_cents = p_truck_fee_cents,
    cubic_feet_per_worker_hour = p_cubic_feet_per_worker_hour, minimum_hours = p_minimum_hours,
    per_mile_cents = p_per_mile_cents, travel_mph = p_travel_mph, road_factor = p_road_factor,
    turnaround_minutes = p_turnaround_minutes, updated_at = now(), updated_by = auth.uid() where id;
exception when check_violation or not_null_violation then
  raise exception 'Pricing values are outside the allowed ranges' using errcode = '22023';
end $$;
create function public.save_pricing_settings(p_worker_hourly_cents integer, p_truck_fee_cents integer,
  p_cubic_feet_per_worker_hour integer, p_minimum_hours numeric, p_per_mile_cents integer, p_travel_mph integer,
  p_road_factor numeric, p_turnaround_minutes integer) returns void
language sql security invoker set search_path='' as $$ select rebel_move_private.save_pricing_settings(p_worker_hourly_cents,
  p_truck_fee_cents, p_cubic_feet_per_worker_hour, p_minimum_hours, p_per_mile_cents, p_travel_mph, p_road_factor, p_turnaround_minutes); $$;

-- Everything the scheduling suggestion needs for one day, read under the
-- caller's RLS. Administrators only; no writes. Times are HH:MM strings and
-- places are "City ZIP" labels for messages. When editing a job, that job's
-- own booking is left out so it does not conflict with itself.
create function public.schedule_candidates(p_estimate_id uuid, p_date date, p_job_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
  req public.move_requests%rowtype;
  dow integer;
  week_start date;
  result jsonb;
begin
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_date is null or p_estimate_id is null then raise exception 'Choose an estimate and date' using errcode = '22023'; end if;
  select r.* into req from public.estimates e join public.move_requests r on r.id = e.request_id where e.id = p_estimate_id;
  if not found then raise exception 'Estimate unavailable' using errcode = '22023'; end if;
  dow := extract(isodow from p_date)::integer;
  week_start := p_date - (dow - 1);

  select jsonb_build_object(
    'pickupZip', req.pickup_address->>'zip',
    'pickupPlace', nullif(concat_ws(' ', req.pickup_address->>'city', req.pickup_address->>'zip'), ''),
    'destinationZip', req.destination_address->>'zip',
    'destinationPlace', nullif(concat_ws(' ', req.destination_address->>'city', req.destination_address->>'zip'), ''),
    'volume', (select coalesce(sum(i.quantity * i.cubic_feet), 0) from public.request_items i where i.request_id = req.id),
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', j.id,
        'start', to_char(j.start_time, 'HH24:MI'),
        'end', to_char(j.end_time, 'HH24:MI'),
        'truckId', j.truck_id,
        'workerIds', (select coalesce(jsonb_agg(w.worker_id order by w.worker_id), '[]'::jsonb) from public.job_workers w where w.job_id = j.id),
        'pickupZip', r.pickup_address->>'zip',
        'pickupPlace', nullif(concat_ws(' ', r.pickup_address->>'city', r.pickup_address->>'zip'), ''),
        'destinationZip', r.destination_address->>'zip',
        'destinationPlace', nullif(concat_ws(' ', r.destination_address->>'city', r.destination_address->>'zip'), '')
      ) order by j.start_time, j.id), '[]'::jsonb)
      from public.jobs j join public.move_requests r on r.id = j.request_id
      where j.scheduled_date = p_date and j.status <> 'cancelled' and j.id is distinct from p_job_id),
    'workers', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', coalesce(nullif(trim(p.full_name), ''), 'Worker'),
        'available', coalesce(a.available, false),
        'availableStart', to_char(a.start_time, 'HH24:MI'),
        'availableEnd', to_char(a.end_time, 'HH24:MI'),
        'weekMinutes', (select coalesce(sum(extract(epoch from (j.end_time - j.start_time)) / 60), 0)::integer
          from public.jobs j join public.job_workers w on w.job_id = j.id
          where w.worker_id = p.id and j.status <> 'cancelled' and j.id is distinct from p_job_id
            and j.scheduled_date between week_start and week_start + 6),
        'fourWeekMinutes', (select coalesce(sum(extract(epoch from (j.end_time - j.start_time)) / 60), 0)::integer
          from public.jobs j join public.job_workers w on w.job_id = j.id
          where w.worker_id = p.id and j.status <> 'cancelled' and j.id is distinct from p_job_id
            and j.scheduled_date between week_start - 21 and week_start + 6)
      ) order by p.full_name, p.id), '[]'::jsonb)
      from public.profiles p
      left join public.worker_availability a on a.worker_id = p.id and a.day = dow
      where p.role = 'worker' and p.active),
    'trucks', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', trim(t.name), 'capacity', t.capacity_cubic_feet
      ) order by t.name, t.id), '[]'::jsonb)
      from public.trucks t where t.active)
  ) into result;
  return result;
end $$;

create function public.scheduling_capabilities() returns integer language sql stable security invoker set search_path='' as $$ select 8; $$;

revoke all on function rebel_move_private.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric,integer),
  public.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric,integer),
  public.schedule_candidates(uuid,date,uuid), public.scheduling_capabilities() from public, anon, authenticated;
grant execute on function rebel_move_private.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric,integer),
  public.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric,integer),
  public.schedule_candidates(uuid,date,uuid), public.scheduling_capabilities() to authenticated;

commit;
