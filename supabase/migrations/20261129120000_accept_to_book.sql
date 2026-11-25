-- Phase 8E: busy-day hints for customers, a proposed appointment on an
-- estimate and acceptance that books it when it is still free.
-- Additive only; apply to the hosted project only after owner approval.
begin;

-- What the customer sees: the proposed date and arrival window only.
alter table public.estimates
  add column proposed_date date,
  add column proposed_arrival_start time,
  add column proposed_arrival_end time,
  add constraint estimates_proposal_complete check (
    (proposed_date is null) = (proposed_arrival_start is null)
    and (proposed_date is null) = (proposed_arrival_end is null));

-- The full proposal, for administrators only. day_jobs records the other
-- same-day jobs of the proposed workers and truck (id → revision) when the
-- administrator proposed it, after the server's travel-time check. Acceptance
-- books only if those jobs are unchanged, so that check still holds.
create table public.estimate_proposals (
  estimate_id uuid primary key references public.estimates(id) on delete cascade,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  arrival_start time not null,
  arrival_end time not null,
  worker_ids uuid[] not null check (cardinality(worker_ids) between 1 and 20),
  truck_id uuid not null references public.trucks(id),
  day_jobs jsonb not null default '{}'::jsonb,
  proposed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (start_time < end_time and arrival_start >= start_time and arrival_start < arrival_end and arrival_end <= end_time)
);
alter table public.estimate_proposals enable row level security;
create policy active_account_required on public.estimate_proposals as restrictive for all to authenticated
  using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy "Administrators read proposals" on public.estimate_proposals for select to authenticated
  using ((select rebel_move_private.is_admin()));
revoke all on public.estimate_proposals from public, anon, authenticated;
grant select on public.estimate_proposals to authenticated;

-- Same-day jobs (id → revision) that involve these workers or this truck.
create function rebel_move_private.resource_day_jobs(p_date date, p_worker_ids uuid[], p_truck_id uuid, p_exclude_request uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_object_agg(j.id, j.revision), '{}'::jsonb) from public.jobs j
  where j.scheduled_date = p_date and j.status <> 'cancelled' and j.request_id is distinct from p_exclude_request
    and (j.truck_id = p_truck_id or exists (select 1 from public.job_workers w where w.job_id = j.id and w.worker_id = any(p_worker_ids)));
$$;

-- True when the workers and truck are active, available for the whole
-- interval and not booked on an overlapping job.
create function rebel_move_private.slot_free(p_date date, p_start time, p_end time, p_worker_ids uuid[], p_truck_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select count(*) from public.profiles where id = any(p_worker_ids) and role = 'worker' and active) = cardinality(p_worker_ids)
    and exists (select 1 from public.trucks where id = p_truck_id and active)
    and not exists (select 1 from unnest(p_worker_ids) as w(id) where not exists (
      select 1 from public.worker_availability a where a.worker_id = w.id and a.day = extract(isodow from p_date)::integer
        and a.available and a.start_time <= p_start and a.end_time >= p_end))
    and not exists (select 1 from public.jobs j join public.job_workers w on w.job_id = j.id
      where w.worker_id = any(p_worker_ids) and j.scheduled_date = p_date and j.status <> 'cancelled'
        and j.start_time < p_end and p_start < j.end_time)
    and not exists (select 1 from public.jobs where truck_id = p_truck_id and scheduled_date = p_date
      and status <> 'cancelled' and start_time < p_end and p_start < end_time);
$$;

-- Administrator: set (or, with a null date, clear) the proposal on a draft.
-- Travel times are checked by the server action before this call.
create function rebel_move_private.set_estimate_proposal(p_estimate_id uuid, p_date date, p_start time, p_end time,
  p_arrival_start time, p_arrival_end time, p_worker_ids uuid[], p_truck_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare e public.estimates%rowtype;
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
  if p_date < (now() at time zone 'America/Chicago')::date or p_start is null or p_end is null or p_start >= p_end
     or p_arrival_start is null or p_arrival_end is null or p_arrival_start < p_start
     or p_arrival_start >= p_arrival_end or p_arrival_end > p_end
     or p_worker_ids is null or cardinality(p_worker_ids) < 1 or array_ndims(p_worker_ids) <> 1
     or exists (select 1 from unnest(p_worker_ids) as x(id) where id is null)
     or (select count(distinct id) from unnest(p_worker_ids) as x(id)) <> cardinality(p_worker_ids) then
    raise exception 'Provide a future same-day interval, an arrival window inside it and a crew' using errcode = '22023'; end if;
  if not rebel_move_private.slot_free(p_date, p_start, p_end, p_worker_ids, p_truck_id) then
    raise exception 'The crew or truck is unavailable or booked at that time' using errcode = '22023'; end if;
  insert into public.estimate_proposals(estimate_id, scheduled_date, start_time, end_time, arrival_start, arrival_end,
    worker_ids, truck_id, day_jobs, proposed_by)
  values (p_estimate_id, p_date, p_start, p_end, p_arrival_start, p_arrival_end, p_worker_ids, p_truck_id,
    rebel_move_private.resource_day_jobs(p_date, p_worker_ids, p_truck_id, e.request_id), auth.uid())
  on conflict (estimate_id) do update set scheduled_date = excluded.scheduled_date, start_time = excluded.start_time,
    end_time = excluded.end_time, arrival_start = excluded.arrival_start, arrival_end = excluded.arrival_end,
    worker_ids = excluded.worker_ids, truck_id = excluded.truck_id, day_jobs = excluded.day_jobs,
    proposed_by = excluded.proposed_by, created_at = now();
  update public.estimates set proposed_date = p_date, proposed_arrival_start = p_arrival_start,
    proposed_arrival_end = p_arrival_end where id = p_estimate_id;
end $$;

-- Customer: accept, and book the proposed appointment when it is still free.
-- Returns 'booked' or 'accepted' (accepted only; an administrator schedules).
create function rebel_move_private.accept_estimate(p_estimate_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare e public.estimates%rowtype; p public.estimate_proposals%rowtype; job_id uuid := gen_random_uuid();
begin
  perform rebel_move_private.decide_estimate(p_estimate_id, 'accepted');
  select * into e from public.estimates where id = p_estimate_id;
  select * into p from public.estimate_proposals where estimate_id = p_estimate_id;
  if not found or p.scheduled_date < (now() at time zone 'America/Chicago')::date then return 'accepted'; end if;
  -- Same lock order as save_job, so concurrent bookings serialize.
  perform 1 from public.profiles where id = any(p.worker_ids) order by id for update;
  perform 1 from public.trucks where id = p.truck_id for update;
  if exists (select 1 from public.jobs where request_id = e.request_id)
     or not rebel_move_private.slot_free(p.scheduled_date, p.start_time, p.end_time, p.worker_ids, p.truck_id)
     or exists (select 1 from jsonb_each_text(rebel_move_private.resource_day_jobs(p.scheduled_date, p.worker_ids, p.truck_id, e.request_id)) as now_jobs(id, revision)
                where p.day_jobs->>now_jobs.id is distinct from now_jobs.revision) then
    return 'accepted';
  end if;
  insert into public.jobs(id, request_id, estimate_id, scheduled_date, start_time, end_time, arrival_start, arrival_end, truck_id)
  values (job_id, e.request_id, e.id, p.scheduled_date, p.start_time, p.end_time, p.arrival_start, p.arrival_end, p.truck_id);
  insert into public.job_workers(job_id, worker_id) select job_id, id from unnest(p.worker_ids) as x(id);
  -- The event is the administrator's proposal, booked by the customer's acceptance.
  insert into public.job_events(job_id, actor_id, action, details)
  values (job_id, p.proposed_by, 'scheduled', jsonb_build_object('date', p.scheduled_date, 'start', p.start_time,
    'end', p.end_time, 'arrival_start', p.arrival_start, 'arrival_end', p.arrival_end, 'truck_id', p.truck_id,
    'worker_ids', p.worker_ids, 'revision', 1, 'booked_on_acceptance', true));
  return 'booked';
end $$;

-- Busy-day hints for signed-in accounts: only 'open', 'limited' or 'full' per
-- day, never names or jobs. Roughly two moves a day for each active truck
-- that has an available mover (crews may be one or more movers).
create function public.day_availability(p_from date, p_days integer) returns table(day date, status text)
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
      - (select count(*) from public.jobs j where j.scheduled_date = d::date and j.status <> 'cancelled') as remaining
    from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as d
  ) days;
end $$;

create function public.set_estimate_proposal(p_estimate_id uuid, p_date date, p_start time, p_end time,
  p_arrival_start time, p_arrival_end time, p_worker_ids uuid[], p_truck_id uuid) returns void
language sql security invoker set search_path='' as $$
  select rebel_move_private.set_estimate_proposal(p_estimate_id, p_date, p_start, p_end, p_arrival_start, p_arrival_end, p_worker_ids, p_truck_id); $$;
create function public.accept_estimate(p_estimate_id uuid) returns text
language sql security invoker set search_path='' as $$ select rebel_move_private.accept_estimate(p_estimate_id); $$;
create function public.booking_capabilities() returns integer
language sql stable security invoker set search_path='' as $$ select 13; $$;

revoke all on function rebel_move_private.resource_day_jobs(date,uuid[],uuid,uuid),
  rebel_move_private.slot_free(date,time,time,uuid[],uuid),
  rebel_move_private.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid),
  rebel_move_private.accept_estimate(uuid),
  public.day_availability(date,integer),
  public.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid),
  public.accept_estimate(uuid), public.booking_capabilities()
  from public, anon, authenticated;
grant execute on function rebel_move_private.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid),
  rebel_move_private.accept_estimate(uuid),
  public.day_availability(date,integer),
  public.set_estimate_proposal(uuid,date,time,time,time,time,uuid[],uuid),
  public.accept_estimate(uuid), public.booking_capabilities()
  to authenticated;

commit;
