-- Phase 9A: long-distance (multi-day) moves, including the crew driving the
-- truck back. A job now occupies its crew and truck for a span:
--   local:          scheduled_date start_time → end_date end_time (same day)
--   long-distance:  scheduled_date start_time → end of return_date
-- Every overlap check uses that span. Existing jobs stay local.
-- Apply to the hosted project only after owner approval.
begin;

alter table public.jobs add column end_date date, add column return_date date;
update public.jobs set end_date = scheduled_date;
alter table public.jobs alter column end_date set not null;
-- Same-day jobs need no delivery date: it defaults to the start date.
create function rebel_move_private.default_end_date() returns trigger
language plpgsql set search_path='' as $$
begin
  new.end_date := coalesce(new.end_date, new.scheduled_date);
  return new;
end $$;
revoke all on function rebel_move_private.default_end_date() from public, anon, authenticated;
create trigger jobs_default_end_date before insert on public.jobs
  for each row execute function rebel_move_private.default_end_date();
alter table public.jobs drop constraint jobs_check, drop constraint jobs_check1;
alter table public.jobs
  add constraint jobs_times check (end_time < '24:00' and (end_date > scheduled_date or start_time < end_time)),
  add constraint jobs_arrival check (arrival_start >= start_time and arrival_start < arrival_end
    and (end_date > scheduled_date or arrival_end <= end_time)),
  add constraint jobs_days check (end_date >= scheduled_date and end_date - scheduled_date <= 30
    and (return_date is null or (return_date >= end_date and return_date - scheduled_date <= 30)));

alter table public.estimate_proposals add column end_date date, add column return_date date;
update public.estimate_proposals set end_date = scheduled_date;
alter table public.estimate_proposals alter column end_date set not null;
alter table public.estimate_proposals drop constraint estimate_proposals_check;
alter table public.estimate_proposals
  add constraint estimate_proposals_times check ((end_date > scheduled_date or start_time < end_time)
    and arrival_start >= start_time and arrival_start < arrival_end and (end_date > scheduled_date or arrival_end <= end_time)),
  add constraint estimate_proposals_days check (end_date >= scheduled_date
    and (return_date is null or return_date >= end_date));

-- The time a job occupies its crew and truck.
create function rebel_move_private.job_span(p_date date, p_start time, p_end_date date, p_end time, p_return date)
returns tsrange language sql immutable set search_path='' as $$
  select tsrange(p_date + p_start,
    case when p_return is null then p_end_date + p_end else (p_return + 1)::timestamp end, '[)');
$$;

-- Workers, truck and span are free: active, available every day of the span
-- (from the start time on day one; to the end time for same-day jobs), and no
-- other job's span overlaps. p_exclude is a job being edited.
drop function rebel_move_private.slot_free(date, time, time, uuid[], uuid);
create function rebel_move_private.slot_free(p_date date, p_start time, p_end_date date, p_end time, p_return date,
  p_worker_ids uuid[], p_truck_id uuid, p_exclude uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
  with span as (select rebel_move_private.job_span(p_date, p_start, p_end_date, p_end, p_return) as s,
                       coalesce(p_return, p_end_date) as last_day)
  select (select count(*) from public.profiles where id = any(p_worker_ids) and role = 'worker' and active) = cardinality(p_worker_ids)
    and exists (select 1 from public.trucks where id = p_truck_id and active)
    and not exists (
      select 1 from unnest(p_worker_ids) as w(id), span, generate_series(p_date, span.last_day, interval '1 day') as d
      where not exists (select 1 from public.worker_availability a where a.worker_id = w.id
        and a.day = extract(isodow from d)::integer and a.available
        and (d::date <> p_date or a.start_time <= p_start)
        and (p_return is not null or d::date <> p_end_date or a.end_time >= p_end)))
    and not exists (select 1 from public.jobs j, span where j.status <> 'cancelled' and j.id is distinct from p_exclude
      and (j.truck_id = p_truck_id or exists (select 1 from public.job_workers w where w.job_id = j.id and w.worker_id = any(p_worker_ids)))
      and rebel_move_private.job_span(j.scheduled_date, j.start_time, j.end_date, j.end_time, j.return_date) && span.s);
$$;

-- Jobs (id → revision) of these workers or this truck on any day from p_from
-- to p_until. A proposal books only if these are unchanged at acceptance.
drop function rebel_move_private.resource_day_jobs(date, uuid[], uuid, uuid);
create function rebel_move_private.resource_day_jobs(p_from date, p_until date, p_worker_ids uuid[], p_truck_id uuid, p_exclude_request uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(j.id, j.revision), '{}'::jsonb) from public.jobs j
  where j.status <> 'cancelled' and j.request_id is distinct from p_exclude_request
    and j.scheduled_date <= p_until and coalesce(j.return_date, j.end_date) >= p_from
    and (j.truck_id = p_truck_id or exists (select 1 from public.job_workers w where w.job_id = j.id and w.worker_id = any(p_worker_ids)));
$$;

-- save_job with optional delivery and return dates. Without them it behaves
-- exactly as before (same-day jobs).
drop function public.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer);
drop function rebel_move_private.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer);
create function rebel_move_private.save_job(p_estimate_id uuid, p_date date, p_start time, p_end time,
  p_arrival_start time, p_arrival_end time, p_worker_ids uuid[], p_truck_id uuid,
  p_job_id uuid default null, p_expected_revision integer default null,
  p_end_date date default null, p_return_date date default null)
returns public.jobs language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  estimate_record public.estimates%rowtype;
  job_record public.jobs%rowtype;
  target_id uuid := coalesce(p_job_id, gen_random_uuid());
  event_action text;
  end_day date := coalesce(p_end_date, p_date);
begin
  perform rebel_move_private.require_active_account();
  if actor is null or not rebel_move_private.is_admin() then
    raise exception 'Only administrators can schedule and assign jobs.' using errcode = '42501'; end if;
  perform 1 from public.profiles p join public.move_requests r on r.customer_id = p.id join public.estimates e on e.request_id = r.id
    where e.id = p_estimate_id and p.active for update of p;
  if not found then raise exception 'Active customer required' using errcode = '22023'; end if;
  if p_date is null or not isfinite(p_date) or p_start is null or p_end is null or p_arrival_start is null or p_arrival_end is null
     or p_end >= time '24:00' or p_arrival_start < p_start or p_arrival_start >= p_arrival_end
     or (end_day = p_date and (p_start >= p_end or p_arrival_end > p_end))
     or end_day < p_date or end_day - p_date > 30
     or (p_return_date is null and end_day <> p_date)
     or (p_return_date is not null and (p_return_date < end_day or p_return_date - p_date > 30))
     or extract(second from p_start) <> 0 or extract(second from p_end) <> 0
     or extract(second from p_arrival_start) <> 0 or extract(second from p_arrival_end) <> 0 then
    raise exception 'Provide a work interval, an arrival window on the first day and, for long-distance moves, delivery and return dates.' using errcode = '22023';
  end if;
  if p_worker_ids is null or cardinality(p_worker_ids) < 1 or array_ndims(p_worker_ids) <> 1
     or exists (select 1 from unnest(p_worker_ids) as x(id) where id is null)
     or (select count(distinct id) from unnest(p_worker_ids) as x(id)) <> cardinality(p_worker_ids) then
    raise exception 'Choose at least one worker without duplicates.' using errcode = '22023'; end if;
  if p_job_id is null then
    if p_expected_revision is not null then raise exception 'New jobs have no prior revision.' using errcode = '22023'; end if;
    select * into estimate_record from public.estimates where id = p_estimate_id for update;
    if not found or estimate_record.status <> 'accepted' then
      raise exception 'An accepted estimate is required.' using errcode = '22023'; end if;
    if exists (select 1 from public.jobs where estimate_id = p_estimate_id or request_id = estimate_record.request_id) then
      raise exception 'This move already has a job.' using errcode = '22023'; end if;
    event_action := 'scheduled';
  else
    select * into job_record from public.jobs where id = p_job_id for update;
    if not found or job_record.status <> 'scheduled' then
      raise exception 'Only scheduled jobs can be edited.' using errcode = '22023'; end if;
    if p_expected_revision is null or job_record.revision <> p_expected_revision then
      raise exception 'The job changed. Reload before saving.' using errcode = '40001'; end if;
    if p_estimate_id is distinct from job_record.estimate_id then
      raise exception 'The estimate linked to a job cannot be replaced.' using errcode = '22023'; end if;
    select * into estimate_record from public.estimates where id = p_estimate_id;
    if estimate_record.status <> 'accepted' then raise exception 'An accepted estimate is required.' using errcode = '22023'; end if;
    event_action := 'rescheduled';
  end if;

  -- Fixed lock order serializes reservations of the same workers/trucks.
  perform 1 from public.profiles where id = any(p_worker_ids) order by id for update;
  if (select count(*) from public.profiles where id = any(p_worker_ids) and role = 'worker' and active) <> cardinality(p_worker_ids) then
    raise exception 'Choose existing worker accounts.' using errcode = '22023'; end if;
  perform 1 from public.trucks where id = p_truck_id and active for update;
  if not found then raise exception 'Choose an existing truck.' using errcode = '22023'; end if;
  if not rebel_move_private.slot_free(p_date, p_start, end_day, p_end, p_return_date, p_worker_ids, p_truck_id, target_id) then
    if exists (select 1 from public.jobs j where j.id <> target_id and j.status <> 'cancelled' and j.truck_id = p_truck_id
        and rebel_move_private.job_span(j.scheduled_date, j.start_time, j.end_date, j.end_time, j.return_date)
          && rebel_move_private.job_span(p_date, p_start, end_day, p_end, p_return_date)) then
      raise exception 'The truck overlaps another job.' using errcode = '22023'; end if;
    if exists (select 1 from public.jobs j join public.job_workers w on w.job_id = j.id
        where w.worker_id = any(p_worker_ids) and j.id <> target_id and j.status <> 'cancelled'
          and rebel_move_private.job_span(j.scheduled_date, j.start_time, j.end_date, j.end_time, j.return_date)
            && rebel_move_private.job_span(p_date, p_start, end_day, p_end, p_return_date)) then
      raise exception 'A worker overlaps another job.' using errcode = '22023'; end if;
    raise exception 'Every worker must be available for every day of the job.' using errcode = '22023';
  end if;

  if p_job_id is not null and job_record.scheduled_date = p_date and job_record.start_time = p_start
     and job_record.end_time = p_end and job_record.end_date = end_day and job_record.return_date is not distinct from p_return_date
     and job_record.arrival_start = p_arrival_start and job_record.arrival_end = p_arrival_end and job_record.truck_id = p_truck_id
     and (select array_agg(worker_id order by worker_id) from public.job_workers where job_id = target_id)
       = (select array_agg(id order by id) from unnest(p_worker_ids) as x(id)) then
    return job_record;
  end if;
  if p_job_id is null then
    insert into public.jobs(id, request_id, estimate_id, scheduled_date, start_time, end_time, arrival_start, arrival_end, truck_id, end_date, return_date)
      values (target_id, estimate_record.request_id, p_estimate_id, p_date, p_start, p_end, p_arrival_start, p_arrival_end, p_truck_id, end_day, p_return_date)
      returning * into job_record;
  else
    update public.jobs set scheduled_date = p_date, start_time = p_start, end_time = p_end, end_date = end_day, return_date = p_return_date,
      arrival_start = p_arrival_start, arrival_end = p_arrival_end, truck_id = p_truck_id,
      revision = revision + 1, updated_at = now() where id = target_id returning * into job_record;
    delete from public.job_workers where job_id = target_id;
  end if;
  insert into public.job_workers(job_id, worker_id) select target_id, id from unnest(p_worker_ids) as x(id);
  insert into public.job_events(job_id, actor_id, action, details)
    values (target_id, actor, event_action, jsonb_build_object(
      'date', p_date, 'start', p_start, 'end', p_end, 'end_date', end_day, 'return_date', p_return_date,
      'arrival_start', p_arrival_start, 'arrival_end', p_arrival_end, 'truck_id', p_truck_id,
      'worker_ids', p_worker_ids, 'revision', job_record.revision));
  return job_record;
end $$;
create function public.save_job(p_estimate_id uuid, p_date date, p_start time, p_end time,
  p_arrival_start time, p_arrival_end time, p_worker_ids uuid[], p_truck_id uuid,
  p_job_id uuid default null, p_expected_revision integer default null,
  p_end_date date default null, p_return_date date default null)
returns public.jobs language sql security invoker set search_path='' as $$
  select rebel_move_private.save_job(p_estimate_id, p_date, p_start, p_end, p_arrival_start, p_arrival_end,
    p_worker_ids, p_truck_id, p_job_id, p_expected_revision, p_end_date, p_return_date); $$;

-- Proposals (8E) with the same dates.
drop function public.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid);
drop function rebel_move_private.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid);
create function rebel_move_private.set_estimate_proposal(p_estimate_id uuid, p_date date, p_start time, p_end time,
  p_arrival_start time, p_arrival_end time, p_worker_ids uuid[], p_truck_id uuid,
  p_end_date date default null, p_return_date date default null) returns void
language plpgsql security definer set search_path='' as $$
declare e public.estimates%rowtype; end_day date := coalesce(p_end_date, p_date);
begin
  perform rebel_move_private.require_active_account();
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  select * into e from public.estimates where id = p_estimate_id for update;
  if not found or e.status <> 'draft' then
    raise exception 'Only a draft estimate can carry a proposed appointment' using errcode = '22023'; end if;
  if p_date is null then
    delete from public.estimate_proposals where estimate_id = p_estimate_id;
    update public.estimates set proposed_date = null, proposed_arrival_start = null, proposed_arrival_end = null where id = p_estimate_id;
    return;
  end if;
  if p_date < (now() at time zone 'America/Chicago')::date or p_start is null or p_end is null
     or p_arrival_start is null or p_arrival_end is null or p_arrival_start < p_start or p_arrival_start >= p_arrival_end
     or (end_day = p_date and (p_start >= p_end or p_arrival_end > p_end))
     or end_day < p_date or end_day - p_date > 30
     or (p_return_date is null and end_day <> p_date)
     or (p_return_date is not null and (p_return_date < end_day or p_return_date - p_date > 30))
     or p_worker_ids is null or cardinality(p_worker_ids) < 1 or array_ndims(p_worker_ids) <> 1
     or exists (select 1 from unnest(p_worker_ids) as x(id) where id is null)
     or (select count(distinct id) from unnest(p_worker_ids) as x(id)) <> cardinality(p_worker_ids) then
    raise exception 'Provide a future interval, an arrival window on the first day and a crew' using errcode = '22023'; end if;
  if not rebel_move_private.slot_free(p_date, p_start, end_day, p_end, p_return_date, p_worker_ids, p_truck_id) then
    raise exception 'The crew or truck is unavailable or booked at that time' using errcode = '22023'; end if;
  insert into public.estimate_proposals(estimate_id, scheduled_date, start_time, end_time, end_date, return_date,
    arrival_start, arrival_end, worker_ids, truck_id, day_jobs, proposed_by)
  values (p_estimate_id, p_date, p_start, p_end, end_day, p_return_date, p_arrival_start, p_arrival_end, p_worker_ids, p_truck_id,
    rebel_move_private.resource_day_jobs(p_date, coalesce(p_return_date, end_day), p_worker_ids, p_truck_id, e.request_id), auth.uid())
  on conflict (estimate_id) do update set scheduled_date = excluded.scheduled_date, start_time = excluded.start_time,
    end_time = excluded.end_time, end_date = excluded.end_date, return_date = excluded.return_date,
    arrival_start = excluded.arrival_start, arrival_end = excluded.arrival_end,
    worker_ids = excluded.worker_ids, truck_id = excluded.truck_id, day_jobs = excluded.day_jobs,
    proposed_by = excluded.proposed_by, created_at = now();
  update public.estimates set proposed_date = p_date, proposed_arrival_start = p_arrival_start,
    proposed_arrival_end = p_arrival_end where id = p_estimate_id;
end $$;
create function public.set_estimate_proposal(p_estimate_id uuid, p_date date, p_start time, p_end time,
  p_arrival_start time, p_arrival_end time, p_worker_ids uuid[], p_truck_id uuid,
  p_end_date date default null, p_return_date date default null) returns void
language sql security invoker set search_path='' as $$
  select rebel_move_private.set_estimate_proposal(p_estimate_id, p_date, p_start, p_end, p_arrival_start, p_arrival_end,
    p_worker_ids, p_truck_id, p_end_date, p_return_date); $$;

create or replace function rebel_move_private.accept_estimate(p_estimate_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare e public.estimates%rowtype; p public.estimate_proposals%rowtype; job_id uuid := gen_random_uuid();
begin
  perform rebel_move_private.decide_estimate(p_estimate_id, 'accepted');
  select * into e from public.estimates where id = p_estimate_id;
  select * into p from public.estimate_proposals where estimate_id = p_estimate_id;
  if not found or p.scheduled_date < (now() at time zone 'America/Chicago')::date then return 'accepted'; end if;
  perform 1 from public.profiles where id = any(p.worker_ids) order by id for update;
  perform 1 from public.trucks where id = p.truck_id for update;
  if exists (select 1 from public.jobs where request_id = e.request_id)
     or not rebel_move_private.slot_free(p.scheduled_date, p.start_time, p.end_date, p.end_time, p.return_date, p.worker_ids, p.truck_id)
     or exists (select 1 from jsonb_each_text(rebel_move_private.resource_day_jobs(p.scheduled_date, coalesce(p.return_date, p.end_date),
                  p.worker_ids, p.truck_id, e.request_id)) as now_jobs(id, revision)
                where p.day_jobs->>now_jobs.id is distinct from now_jobs.revision) then
    return 'accepted';
  end if;
  insert into public.jobs(id, request_id, estimate_id, scheduled_date, start_time, end_time, end_date, return_date, arrival_start, arrival_end, truck_id)
  values (job_id, e.request_id, e.id, p.scheduled_date, p.start_time, p.end_time, p.end_date, p.return_date, p.arrival_start, p.arrival_end, p.truck_id);
  insert into public.job_workers(job_id, worker_id) select job_id, id from unnest(p.worker_ids) as x(id);
  insert into public.job_events(job_id, actor_id, action, details)
  values (job_id, p.proposed_by, 'scheduled', jsonb_build_object('date', p.scheduled_date, 'start', p.start_time,
    'end', p.end_time, 'end_date', p.end_date, 'return_date', p.return_date, 'arrival_start', p.arrival_start,
    'arrival_end', p.arrival_end, 'truck_id', p.truck_id, 'worker_ids', p.worker_ids, 'revision', 1, 'booked_on_acceptance', true));
  return 'booked';
end $$;

-- Bookings shown in the schedule form for one day: multi-day jobs appear on
-- every day they occupy, with that day's part of their span.
create or replace function rebel_move_private.resource_bookings(p_date date)
returns table(job_id uuid, start_time time, end_time time, worker_ids uuid[], truck_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  perform rebel_move_private.require_active_account();
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  return query select j.id,
    case when j.scheduled_date = p_date then j.start_time else time '00:00' end,
    case when j.return_date is null and j.end_date = p_date then j.end_time else time '23:59' end,
    array(select w.worker_id from public.job_workers w where w.job_id = j.id), j.truck_id
  from public.jobs j where j.status <> 'cancelled' and j.scheduled_date <= p_date and coalesce(j.return_date, j.end_date) >= p_date
  order by 2, j.id;
end $$;

-- Day hints count a job on every day it occupies.
create or replace function rebel_move_private.day_availability(p_from date, p_days integer) returns table(day date, status text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform rebel_move_private.require_active_account();
  if p_from is null or p_days is null or p_days not between 1 and 62
     or p_from < (now() at time zone 'America/Chicago')::date then
    raise exception 'Choose up to 62 days from today' using errcode = '22023'; end if;
  return query
  select d::date, case when remaining <= 0 then 'full' when remaining = 1 then 'limited' else 'open' end
  from (
    select d, least((select count(*) from public.trucks where active),
        (select count(*) from public.profiles pr join public.worker_availability a on a.worker_id = pr.id
          where pr.role = 'worker' and pr.active and a.available and a.day = extract(isodow from d)::integer)) * 2
      - (select count(*) from public.jobs j where j.status <> 'cancelled'
           and j.scheduled_date <= d::date and coalesce(j.return_date, j.end_date) >= d::date) as remaining
    from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as d
  ) days;
end $$;

-- Scheduling suggestion context (7B) for a span. "jobs" stays the same-day
-- local jobs used for travel times; "away" lists every other job occupying a
-- day of the span (multi-day moves, or any job on a later day).
drop function public.schedule_candidates(uuid, date, uuid);
create function public.schedule_candidates(p_estimate_id uuid, p_date date, p_job_id uuid default null, p_until date default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  req public.move_requests%rowtype;
  dow integer;
  week_start date;
  until_day date := greatest(coalesce(p_until, p_date), p_date);
  result jsonb;
begin
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_date is null or p_estimate_id is null or until_day - p_date > 30 then
    raise exception 'Choose an estimate and date' using errcode = '22023'; end if;
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
      where j.scheduled_date = p_date and j.end_date = p_date and j.return_date is null
        and j.status <> 'cancelled' and j.id is distinct from p_job_id),
    'away', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', j.id,
        'from', j.scheduled_date,
        'until', coalesce(j.return_date, j.end_date),
        'truckId', j.truck_id,
        'workerIds', (select coalesce(jsonb_agg(w.worker_id order by w.worker_id), '[]'::jsonb) from public.job_workers w where w.job_id = j.id)
      ) order by j.scheduled_date, j.id), '[]'::jsonb)
      from public.jobs j
      where j.status <> 'cancelled' and j.id is distinct from p_job_id
        and j.scheduled_date <= until_day and coalesce(j.return_date, j.end_date) >= p_date
        and not (j.scheduled_date = p_date and j.end_date = p_date and j.return_date is null)),
    'workers', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', coalesce(nullif(trim(p.full_name), ''), 'Worker'),
        'available', coalesce(a.available, false),
        'availableStart', to_char(a.start_time, 'HH24:MI'),
        'availableEnd', to_char(a.end_time, 'HH24:MI'),
        -- Available on every later day of the span (true for same-day jobs).
        'availableEveryDay', not exists (select 1 from generate_series(p_date + 1, until_day, interval '1 day') as d
          where not exists (select 1 from public.worker_availability x where x.worker_id = p.id
            and x.day = extract(isodow from d)::integer and x.available)),
        'weekMinutes', (select coalesce(sum(rebel_move_private.job_minutes(j)), 0)::integer
          from public.jobs j join public.job_workers w on w.job_id = j.id
          where w.worker_id = p.id and j.status <> 'cancelled' and j.id is distinct from p_job_id
            and j.scheduled_date between week_start and week_start + 6),
        'fourWeekMinutes', (select coalesce(sum(rebel_move_private.job_minutes(j)), 0)::integer
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

-- Workload for fairness ranking: same-day jobs by their hours; multi-day jobs
-- count 10 hours for each day they occupy.
create function rebel_move_private.job_minutes(j public.jobs) returns numeric
language sql immutable set search_path='' as $$
  select case when j.return_date is null and j.end_date = j.scheduled_date
    then extract(epoch from (j.end_time - j.start_time)) / 60
    else (coalesce(j.return_date, j.end_date) - j.scheduled_date + 1) * 600 end;
$$;

create function public.long_distance_capabilities() returns integer
language sql stable security invoker set search_path='' as $$ select 15; $$;

revoke all on function rebel_move_private.job_span(date,time,date,time,date),
  rebel_move_private.slot_free(date,time,date,time,date,uuid[],uuid,uuid),
  rebel_move_private.resource_day_jobs(date,date,uuid[],uuid,uuid),
  rebel_move_private.job_minutes(public.jobs),
  rebel_move_private.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer,date,date),
  public.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer,date,date),
  rebel_move_private.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid,date,date),
  public.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid,date,date),
  public.schedule_candidates(uuid,date,uuid,date), public.long_distance_capabilities()
  from public, anon, authenticated;
grant execute on function
  rebel_move_private.job_minutes(public.jobs),
  rebel_move_private.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer,date,date),
  public.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer,date,date),
  rebel_move_private.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid,date,date),
  public.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid,date,date),
  public.schedule_candidates(uuid,date,uuid,date), public.long_distance_capabilities()
  to authenticated;

commit;
