-- Requires the guided foundation and estimate-workflow.sql.
begin;

alter table public.estimates add constraint estimates_id_request_unique unique(id, request_id);

create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create table public.worker_availability (
  worker_id uuid not null references public.profiles(id),
  day integer not null check(day between 1 and 7),
  available boolean not null,
  start_time time not null,
  end_time time not null,
  primary key(worker_id, day),
  check(start_time < time '24:00' and end_time < time '24:00'),
  check(extract(second from start_time)=0 and extract(second from end_time)=0),
  check(not available or end_time > start_time)
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.move_requests(id),
  estimate_id uuid not null unique,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  arrival_start time not null,
  arrival_end time not null,
  truck_id uuid not null references public.trucks(id),
  status text not null default 'scheduled' check(status in ('scheduled','in-progress','completed')),
  revision integer not null default 1 check(revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(estimate_id, request_id) references public.estimates(id, request_id),
  check(start_time < end_time and end_time < time '24:00'),
  check(arrival_start >= start_time and arrival_start < arrival_end and arrival_end <= end_time),
  check(extract(second from start_time)=0 and extract(second from end_time)=0
    and extract(second from arrival_start)=0 and extract(second from arrival_end)=0)
);
create index jobs_truck_date_idx on public.jobs(truck_id, scheduled_date);
create index jobs_estimate_request_idx on public.jobs(estimate_id, request_id);
create table public.job_workers (
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_id uuid not null references public.profiles(id),
  primary key(job_id, worker_id)
);
create index job_workers_worker_id_idx on public.job_workers(worker_id, job_id);
create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  actor_id uuid not null references public.profiles(id),
  action text not null check(action in ('scheduled','rescheduled','in-progress','completed')),
  details jsonb not null,
  occurred_at timestamptz not null default now()
);
create index job_events_job_id_idx on public.job_events(job_id);
create index job_events_actor_id_idx on public.job_events(actor_id);

alter table public.trucks enable row level security;
alter table public.worker_availability enable row level security;
alter table public.jobs enable row level security;
alter table public.job_workers enable row level security;
alter table public.job_events enable row level security;
revoke all on public.trucks, public.worker_availability, public.jobs, public.job_workers, public.job_events
  from anon, authenticated;
grant select on public.trucks, public.worker_availability, public.jobs, public.job_workers, public.job_events
  to authenticated;
grant insert(name) on public.trucks to authenticated;

-- Private helpers avoid recursive policies through jobs/assignments/profiles.
create function rebel_move_private.is_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
revoke all on function rebel_move_private.is_admin() from public, anon, authenticated;
grant execute on function rebel_move_private.is_admin() to authenticated;

create function rebel_move_private.can_read_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.jobs j
    join public.move_requests r on r.id=j.request_id
    join public.profiles p on p.id=auth.uid()
    where j.id=p_job_id and (
      p.role='admin'
      or (p.role='customer' and r.customer_id=p.id)
      or (p.role='worker' and exists(
        select 1 from public.job_workers w where w.job_id=j.id and w.worker_id=p.id
      ))
    )
  );
$$;
revoke all on function rebel_move_private.can_read_job(uuid) from public, anon, authenticated;
grant execute on function rebel_move_private.can_read_job(uuid) to authenticated;

create function rebel_move_private.worker_can_read_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.jobs j
    join public.job_workers w on w.job_id=j.id
    join public.profiles p on p.id=w.worker_id
    where j.request_id=p_request_id and p.id=auth.uid() and p.role='worker'
  );
$$;
revoke all on function rebel_move_private.worker_can_read_request(uuid) from public, anon, authenticated;
grant execute on function rebel_move_private.worker_can_read_request(uuid) to authenticated;

create policy "Administrators can read profiles" on public.profiles for select to authenticated
  using ((select rebel_move_private.is_admin()));
create policy "Assigned workers can read request details" on public.move_requests for select to authenticated
  using(rebel_move_private.worker_can_read_request(id));
create policy "Read accessible jobs" on public.jobs for select to authenticated
  using(rebel_move_private.can_read_job(id));
create policy "Read accessible crews" on public.job_workers for select to authenticated
  using(rebel_move_private.can_read_job(job_id));
create policy "Read accessible job events" on public.job_events for select to authenticated
  using(rebel_move_private.can_read_job(job_id));
create policy "Read own availability or administer availability" on public.worker_availability
  for select to authenticated using(worker_id=(select auth.uid()) or (select rebel_move_private.is_admin()));
create policy "Read trucks for accessible jobs or administer trucks" on public.trucks
  for select to authenticated using(
    (select rebel_move_private.is_admin())
    or exists(select 1 from public.jobs where truck_id=trucks.id)
  );
create policy "Administrators can add trucks" on public.trucks for insert to authenticated
  with check((select rebel_move_private.is_admin()));

create function rebel_move_private.save_worker_availability(p_days jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  -- This same worker row is locked by scheduling, preventing a stale availability check.
  perform 1 from public.profiles where id=actor and role='worker' for update;
  if not found then raise exception 'Only workers can save their availability.' using errcode='42501'; end if;
  if p_days is null or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days)<>7 then
    raise exception 'Provide seven daily availability entries.' using errcode='22023';
  end if;
  if (select count(distinct day) from jsonb_to_recordset(p_days) as x(day integer))<>7
    or exists(
      select 1 from jsonb_to_recordset(p_days)
        as x(day integer, available boolean, start_time time, end_time time)
      where day is null or day not between 1 and 7 or available is null
        or start_time is null or end_time is null or start_time>=time '24:00' or end_time>=time '24:00'
        or extract(second from start_time)<>0 or extract(second from end_time)<>0
        or (available and end_time<=start_time)
    ) then raise exception 'Provide valid unique days and same-day availability times.' using errcode='22023'; end if;
  insert into public.worker_availability(worker_id,day,available,start_time,end_time)
    select actor, day, available, start_time, end_time from jsonb_to_recordset(p_days)
      as x(day integer,available boolean,start_time time,end_time time)
    on conflict(worker_id,day) do update set available=excluded.available,
      start_time=excluded.start_time,end_time=excluded.end_time;
end;
$$;
revoke all on function rebel_move_private.save_worker_availability(jsonb) from public, anon, authenticated;
grant execute on function rebel_move_private.save_worker_availability(jsonb) to authenticated;

create function rebel_move_private.save_job(
  p_estimate_id uuid, p_date date, p_start time, p_end time,
  p_arrival_start time, p_arrival_end time, p_worker_ids uuid[], p_truck_id uuid,
  p_job_id uuid default null, p_expected_revision integer default null
)
returns public.jobs language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  estimate_record public.estimates%rowtype;
  job_record public.jobs%rowtype;
  target_id uuid:=coalesce(p_job_id,gen_random_uuid());
  event_action text;
begin
  if actor is null or not rebel_move_private.is_admin() then
    raise exception 'Only administrators can schedule and assign jobs.' using errcode='42501';
  end if;
  if p_date is null or not isfinite(p_date) or p_start is null or p_end is null or p_arrival_start is null
    or p_arrival_end is null or p_start>=p_end or p_end>=time '24:00'
    or p_arrival_start<p_start or p_arrival_start>=p_arrival_end or p_arrival_end>p_end
    or extract(second from p_start)<>0 or extract(second from p_end)<>0
    or extract(second from p_arrival_start)<>0 or extract(second from p_arrival_end)<>0 then
    raise exception 'Provide a same-day work interval with an arrival window inside it.' using errcode='22023';
  end if;
  if p_worker_ids is null or cardinality(p_worker_ids)<1
    or array_ndims(p_worker_ids)<>1
    or exists(select 1 from unnest(p_worker_ids) as x(id) where id is null)
    or (select count(distinct id) from unnest(p_worker_ids) as x(id))<>cardinality(p_worker_ids) then
    raise exception 'Choose at least one worker without duplicates.' using errcode='22023';
  end if;
  if p_job_id is null then
    if p_expected_revision is not null then raise exception 'New jobs have no prior revision.' using errcode='22023'; end if;
    select * into estimate_record from public.estimates where id=p_estimate_id for update;
    if not found or estimate_record.status<>'accepted' then
      raise exception 'An accepted estimate is required.' using errcode='22023'; end if;
    if exists(select 1 from public.jobs where estimate_id=p_estimate_id or request_id=estimate_record.request_id) then
      raise exception 'This move already has a job.' using errcode='22023'; end if;
    event_action:='scheduled';
  else
    select * into job_record from public.jobs where id=p_job_id for update;
    if not found or job_record.status<>'scheduled' then
      raise exception 'Only scheduled jobs can be edited.' using errcode='22023'; end if;
    if p_expected_revision is null or job_record.revision<>p_expected_revision then
      raise exception 'The job changed. Reload before saving.' using errcode='40001'; end if;
    if p_estimate_id is distinct from job_record.estimate_id then
      raise exception 'The estimate linked to a job cannot be replaced.' using errcode='22023'; end if;
    select * into estimate_record from public.estimates where id=p_estimate_id;
    if estimate_record.status<>'accepted' then raise exception 'An accepted estimate is required.' using errcode='22023'; end if;
    event_action:='rescheduled';
  end if;

  -- Fixed lock order serializes reservations of the same workers/trucks.
  perform 1 from public.profiles where id=any(p_worker_ids) order by id for update;
  if (select count(*) from public.profiles where id=any(p_worker_ids) and role='worker')<>cardinality(p_worker_ids) then
    raise exception 'Choose existing worker accounts.' using errcode='22023'; end if;
  perform 1 from public.trucks where id=p_truck_id for update;
  if not found then raise exception 'Choose an existing truck.' using errcode='22023'; end if;
  if exists(
    select 1 from unnest(p_worker_ids) as w(id) where not exists(
      select 1 from public.worker_availability a where a.worker_id=w.id
        and a.day=extract(isodow from p_date)::integer and a.available
        and a.start_time<=p_start and a.end_time>=p_end
    )
  ) then raise exception 'Every worker must be available for the full work interval.' using errcode='22023'; end if;
  if exists(
    select 1 from public.jobs j join public.job_workers w on w.job_id=j.id
    where w.worker_id=any(p_worker_ids) and j.id<>target_id and j.scheduled_date=p_date
      and j.start_time<p_end and p_start<j.end_time
  ) then raise exception 'A worker overlaps another job.' using errcode='22023'; end if;
  if exists(
    select 1 from public.jobs where truck_id=p_truck_id and id<>target_id and scheduled_date=p_date
      and start_time<p_end and p_start<end_time
  ) then raise exception 'The truck overlaps another job.' using errcode='22023'; end if;

  if p_job_id is not null and job_record.scheduled_date=p_date and job_record.start_time=p_start
    and job_record.end_time=p_end and job_record.arrival_start=p_arrival_start
    and job_record.arrival_end=p_arrival_end and job_record.truck_id=p_truck_id
    and (select array_agg(worker_id order by worker_id) from public.job_workers where job_id=target_id)
      = (select array_agg(id order by id) from unnest(p_worker_ids) as x(id)) then
    return job_record;
  end if;
  if p_job_id is null then
    insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id)
      values(target_id,estimate_record.request_id,p_estimate_id,p_date,p_start,p_end,p_arrival_start,p_arrival_end,p_truck_id)
      returning * into job_record;
  else
    update public.jobs set scheduled_date=p_date,start_time=p_start,end_time=p_end,
      arrival_start=p_arrival_start,arrival_end=p_arrival_end,truck_id=p_truck_id,
      revision=revision+1,updated_at=now() where id=target_id returning * into job_record;
    delete from public.job_workers where job_id=target_id;
  end if;
  insert into public.job_workers(job_id,worker_id) select target_id,id from unnest(p_worker_ids) as x(id);
  insert into public.job_events(job_id,actor_id,action,details)
    values(target_id,actor,event_action,jsonb_build_object(
      'date',p_date,'start',p_start,'end',p_end,'arrival_start',p_arrival_start,
      'arrival_end',p_arrival_end,'truck_id',p_truck_id,'worker_ids',p_worker_ids,'revision',job_record.revision
    ));
  return job_record;
end;
$$;
revoke all on function rebel_move_private.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer)
  from public, anon, authenticated;
grant execute on function rebel_move_private.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer) to authenticated;

create function rebel_move_private.advance_job(p_job_id uuid,p_expected_status text,p_expected_revision integer)
returns public.jobs language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); job_record public.jobs%rowtype; next_status text;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='worker') then
    raise exception 'Only assigned workers can update progress.' using errcode='42501'; end if;
  select * into job_record from public.jobs where id=p_job_id for update;
  if not found or not exists(select 1 from public.job_workers where job_id=p_job_id and worker_id=actor) then
    raise exception 'This job is not assigned to this worker.' using errcode='42501'; end if;
  if p_expected_status is distinct from job_record.status
    or p_expected_revision is distinct from job_record.revision then
    raise exception 'The job changed. Reload before updating progress.' using errcode='40001'; end if;
  if job_record.status='completed' then raise exception 'Completed jobs are read-only.' using errcode='22023'; end if;
  next_status:=case when job_record.status='scheduled' then 'in-progress' else 'completed' end;
  update public.jobs set status=next_status,revision=revision+1,updated_at=now()
    where id=p_job_id returning * into job_record;
  insert into public.job_events(job_id,actor_id,action,details)
    values(p_job_id,actor,next_status,jsonb_build_object('previous_status',p_expected_status,'revision',job_record.revision));
  return job_record;
end;
$$;
revoke all on function rebel_move_private.advance_job(uuid,text,integer) from public, anon, authenticated;
grant execute on function rebel_move_private.advance_job(uuid,text,integer) to authenticated;

create function public.save_worker_availability(p_days jsonb)
returns void language sql security invoker set search_path=''
as $$ select rebel_move_private.save_worker_availability(p_days); $$;
revoke all on function public.save_worker_availability(jsonb) from public, anon, authenticated;
grant execute on function public.save_worker_availability(jsonb) to authenticated;

create function public.save_job(
  p_estimate_id uuid,p_date date,p_start time,p_end time,p_arrival_start time,p_arrival_end time,
  p_worker_ids uuid[],p_truck_id uuid,p_job_id uuid default null,p_expected_revision integer default null
)
returns public.jobs language sql security invoker set search_path=''
as $$ select rebel_move_private.save_job(p_estimate_id,p_date,p_start,p_end,p_arrival_start,p_arrival_end,
  p_worker_ids,p_truck_id,p_job_id,p_expected_revision); $$;
revoke all on function public.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.save_job(uuid,date,time,time,time,time,uuid[],uuid,uuid,integer) to authenticated;

create function public.advance_job(p_job_id uuid,p_expected_status text,p_expected_revision integer)
returns public.jobs language sql security invoker set search_path=''
as $$ select rebel_move_private.advance_job(p_job_id,p_expected_status,p_expected_revision); $$;
revoke all on function public.advance_job(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.advance_job(uuid,text,integer) to authenticated;

commit;
