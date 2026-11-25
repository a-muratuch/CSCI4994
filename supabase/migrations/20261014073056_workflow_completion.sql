-- Phase 4 workflow foundation. Proposed for hosted use only after owner approval.
begin;
alter table public.move_requests add column revision integer not null default 1 check (revision > 0),
 add column status text not null default 'pending' check (status in ('pending','cancelled')),
 add column pickup_address jsonb, add column destination_address jsonb;
alter table public.estimates drop constraint estimates_request_id_key;
alter table public.estimates add column version integer not null default 1 check (version > 0),
 add column is_current boolean not null default true,
 add column previous_estimate_id uuid references public.estimates(id),
 add column request_revision integer not null default 1;
alter table public.estimate_events drop constraint estimate_events_previous_status_check;
alter table public.estimate_events add constraint estimate_events_previous_status_check check (previous_status in ('draft','awaiting','declined'));
alter table public.estimate_events drop constraint estimate_events_new_status_check;
alter table public.estimate_events add constraint estimate_events_new_status_check check (new_status in ('draft','awaiting','accepted','declined'));
create unique index estimates_one_current on public.estimates(request_id) where is_current;
create unique index estimates_version on public.estimates(request_id,version);
alter table public.jobs drop constraint jobs_status_check;
alter table public.jobs add constraint jobs_status_check check (status in ('scheduled','in-progress','completed','cancelled'));
create table public.request_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.move_requests(id),
 actor_id uuid not null references public.profiles(id), action text not null check (action in ('edited','cancelled')),
 occurred_at timestamptz not null default now()
);
create index request_events_route_history on public.request_events(request_id,occurred_at,id);
alter table public.request_events enable row level security;
revoke all on public.request_events from anon, authenticated;
grant select on public.request_events to authenticated;
create policy request_event_read on public.request_events for select to authenticated using (
 exists(select 1 from public.move_requests r where r.id=request_id)
);
create table public.conversation_reads (
 conversation_id uuid not null references public.conversations(id), user_id uuid not null references public.profiles(id),
 read_at timestamptz not null default now(), primary key(conversation_id,user_id)
);
alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon, authenticated;
grant select on public.conversation_reads to authenticated;
create policy own_conversation_reads on public.conversation_reads for select to authenticated using (
 user_id=(select auth.uid()) and rebel_move_private.can_read_conversation(conversation_id)
);
CREATE OR REPLACE FUNCTION rebel_move_private.publish_estimate(p_estimate_id uuid)
 RETURNS estimates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform 1 from public.move_requests where id=(select request_id from public.estimates where id=p_estimate_id) for update;
  select * into estimate_record from public.estimates
    where id = p_estimate_id for update;
  if not found or (estimate_record.status <> 'draft' or not estimate_record.is_current) then
    raise exception 'A draft estimate is required.' using errcode = '22023';
  end if;
  if not exists(select 1 from public.move_requests r where r.id=estimate_record.request_id
    and r.status='pending' and r.revision=estimate_record.request_revision) then
    raise exception 'Request changed; review and save the draft again' using errcode='40001';
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
$function$;
CREATE OR REPLACE FUNCTION rebel_move_private.publish_reviewed_estimate(p_estimate_id uuid, p_revision integer)
 RETURNS estimates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare saved public.estimates%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Administrator required' using errcode='42501'; end if;
  perform 1 from public.move_requests where id=(select request_id from public.estimates where id=p_estimate_id) for update;
  select * into saved from public.estimates where id=p_estimate_id for update;
  if not found or saved.revision is distinct from p_revision or saved.status <> 'draft' then raise exception 'Draft changed or published; review again' using errcode='40001'; end if;
  return rebel_move_private.publish_estimate(p_estimate_id);
end $function$;
CREATE OR REPLACE FUNCTION rebel_move_private.decide_estimate(p_estimate_id uuid, p_decision text)
 RETURNS estimates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform 1 from public.move_requests where id=(select request_id from public.estimates where id=p_estimate_id) for update;
  select * into estimate_record from public.estimates
    where id = p_estimate_id for update;
  if not found or not exists (
    select 1 from public.move_requests
    where id = estimate_record.request_id and customer_id = actor
  ) then
    raise exception 'This estimate is not available to this customer.' using errcode = '42501';
  end if;
  if (estimate_record.status <> 'awaiting' or not estimate_record.is_current) then
    raise exception 'Only an estimate awaiting a decision can be accepted or declined.'
      using errcode = '22023';
  end if;
  update public.estimates set status = p_decision, decided_at = now()
    where id = p_estimate_id returning * into estimate_record;
  insert into public.estimate_events(estimate_id, actor_id, previous_status, new_status)
    values (p_estimate_id, actor, 'awaiting', p_decision);
  return estimate_record;
end;
$function$;
CREATE OR REPLACE FUNCTION rebel_move_private.save_estimate_draft(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb)
 RETURNS estimates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  saved public.estimates%rowtype;
  line jsonb;
  included text[];
  excluded text[];
  price bigint := 0;
  position integer := 0;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if jsonb_typeof(p_input) is distinct from 'object'
    or jsonb_typeof(p_input->'lines') is distinct from 'array'
    or jsonb_typeof(p_input->'inclusions') is distinct from 'array'
    or jsonb_typeof(p_input->'exclusions') is distinct from 'array'
    or jsonb_typeof(p_input->'terms') is distinct from 'string' then
    raise exception 'Invalid draft' using errcode='22023';
  end if;
  if jsonb_array_length(p_input->'lines') not between 1 and 20
    or jsonb_array_length(p_input->'inclusions') not between 1 and 20
    or jsonb_array_length(p_input->'exclusions') not between 1 and 20
    or char_length(trim(p_input->>'terms')) not between 1 and 2000 then
    raise exception 'Invalid scope or terms' using errcode='22023';
  end if;
  for line in select value from jsonb_array_elements(p_input->'lines') loop
    if jsonb_typeof(line) is distinct from 'object'
      or jsonb_typeof(line->'label') is distinct from 'string'
      or char_length(trim(line->>'label')) not between 1 and 150
      or jsonb_typeof(line->'amountCents') is distinct from 'number'
      or not ((line->>'amountCents') ~ '^[0-9]{1,9}$') then
      raise exception 'Invalid pricing line' using errcode='22023';
    end if;
    price := price + (line->>'amountCents')::bigint;
  end loop;
  if price not between 1 and 999999999 then raise exception 'Invalid total' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements((p_input->'inclusions')||(p_input->'exclusions')) x
    where jsonb_typeof(x) is distinct from 'string' or char_length(trim(x #>> '{}')) not between 1 and 500) then
    raise exception 'Invalid scope item' using errcode='22023';
  end if;
  select array_agg(trim(value)) into included from jsonb_array_elements_text(p_input->'inclusions');
  select array_agg(trim(value)) into excluded from jsonb_array_elements_text(p_input->'exclusions');
  -- The parent lock serializes duplicate creation; the estimate lock matches publication.
  perform 1 from public.move_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'Request unavailable' using errcode='22023'; end if;
  select * into saved from public.estimates where request_id=p_request_id and is_current for update;
  if found then
    if p_estimate_id is distinct from saved.id or p_revision is distinct from saved.revision or saved.status <> 'draft' then
      raise exception 'Draft changed or published; reopen it' using errcode='40001';
    end if;
    update public.estimates set inclusions=included, exclusions=excluded, terms=trim(p_input->>'terms'), revision=revision+1, request_revision=(select revision from public.move_requests where id=p_request_id)
      where id=saved.id returning * into saved;
    delete from public.estimate_items where estimate_id=saved.id;
  else
    if p_estimate_id is not null or p_revision is distinct from 0 then raise exception 'Draft unavailable' using errcode='40001'; end if;
    insert into public.estimates(request_id,created_by,inclusions,exclusions,terms,request_revision)
      values(p_request_id,actor,included,excluded,trim(p_input->>'terms'),(select revision from public.move_requests where id=p_request_id)) returning * into saved;
  end if;
  for line in select value from jsonb_array_elements(p_input->'lines') loop
    position := position+1;
    insert into public.estimate_items(estimate_id,position,label,amount_cents)
      values(saved.id,position,trim(line->>'label'),(line->>'amountCents')::integer);
  end loop;
  select * into saved from public.estimates where id=saved.id;
  return saved;
end $function$;
CREATE OR REPLACE FUNCTION rebel_move_private.save_job(p_estimate_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_arrival_start time without time zone, p_arrival_end time without time zone, p_worker_ids uuid[], p_truck_id uuid, p_job_id uuid DEFAULT NULL::uuid, p_expected_revision integer DEFAULT NULL::integer)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    where w.worker_id=any(p_worker_ids) and j.id<>target_id and j.scheduled_date=p_date and j.status<>'cancelled'
      and j.start_time<p_end and p_start<j.end_time
  ) then raise exception 'A worker overlaps another job.' using errcode='22023'; end if;
  if exists(
    select 1 from public.jobs where truck_id=p_truck_id and id<>target_id and scheduled_date=p_date and status<>'cancelled'
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
$function$;

create function rebel_move_private.cancel_job(p_id uuid,p_revision integer) returns public.jobs
language plpgsql security definer set search_path='' as $$
declare saved public.jobs%rowtype;
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into saved from public.jobs where id=p_id for update;
 if not found or saved.status<>'scheduled' or saved.revision is distinct from p_revision then
 raise exception 'Job changed or cannot be cancelled' using errcode='40001'; end if;
 update public.jobs set status='cancelled',revision=revision+1,updated_at=now() where id=p_id returning * into saved;
 insert into public.job_events(job_id,actor_id,action,details) values(p_id,auth.uid(),'cancelled',jsonb_build_object('revision',saved.revision));
 return saved;
end $$;
create function rebel_move_private.revise_estimate(p_id uuid,p_revision integer) returns public.estimates
language plpgsql security definer set search_path='' as $$
declare previous public.estimates%rowtype; saved public.estimates%rowtype;
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 perform 1 from public.move_requests where id=(select request_id from public.estimates where id=p_id) and status='pending' for update;
 if not found then raise exception 'Request unavailable' using errcode='22023'; end if;
 select * into previous from public.estimates where id=p_id for update;
 if not found or previous.status<>'declined' or not previous.is_current or previous.revision is distinct from p_revision then
 raise exception 'Estimate changed; reopen it' using errcode='40001'; end if;
 update public.estimates set is_current=false where id=p_id;
 insert into public.estimates(request_id,terms,inclusions,exclusions,created_by,version,previous_estimate_id,request_revision)
 values(previous.request_id,previous.terms,previous.inclusions,previous.exclusions,auth.uid(),previous.version+1,previous.id,
 (select revision from public.move_requests where id=previous.request_id)) returning * into saved;
 insert into public.estimate_items(estimate_id,position,label,amount_cents)
 select saved.id,position,label,amount_cents from public.estimate_items where estimate_id=p_id;
 select * into saved from public.estimates where id=saved.id;
 insert into public.estimate_events(estimate_id,actor_id,previous_status,new_status) values(saved.id,auth.uid(),'declined','draft');
 return saved;
end $$;
create function rebel_move_private.mark_conversation_read(p_id uuid,p_message_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz;
begin
 if not rebel_move_private.can_read_conversation(p_id) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 select created_at into cutoff from public.messages where id=p_message_id and conversation_id=p_id;
 if not found then raise exception 'Message unavailable' using errcode='22023'; end if;
 insert into public.conversation_reads(conversation_id,user_id,read_at) values(p_id,auth.uid(),cutoff)
 on conflict(conversation_id,user_id) do update set read_at=greatest(public.conversation_reads.read_at,excluded.read_at);
end $$;
create function rebel_move_private.unread_messages() returns bigint
language sql stable security definer set search_path='' as $$
 select count(*) from public.messages m where m.sender_id<>auth.uid() and rebel_move_private.can_read_conversation(m.conversation_id)
 and not exists(select 1 from public.conversation_reads r where r.conversation_id=m.conversation_id and r.user_id=auth.uid() and r.read_at>=m.created_at);
$$;
create function rebel_move_private.assigned_customer_phone(p_job_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare phone text;
begin
 if not exists(select 1 from public.job_workers w join public.profiles p on p.id=w.worker_id where w.job_id=p_job_id and w.worker_id=auth.uid() and p.role='worker') then
 raise exception 'Assigned worker required' using errcode='42501'; end if;
 select p.phone into phone from public.jobs j join public.move_requests r on r.id=j.request_id join public.profiles p on p.id=r.customer_id where j.id=p_job_id;
 return phone;
end $$;
create function rebel_move_private.resource_bookings(p_date date) returns table(job_id uuid,start_time time,end_time time,worker_ids uuid[],truck_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return query select j.id,j.start_time,j.end_time,array(select w.worker_id from public.job_workers w where w.job_id=j.id),j.truck_id
 from public.jobs j where j.scheduled_date=p_date and j.status<>'cancelled' order by j.start_time,j.id;
end $$;
create function public.cancel_job(p_id uuid,p_revision integer) returns public.jobs language sql security invoker set search_path='' as $$ select rebel_move_private.cancel_job(p_id,p_revision); $$;
revoke all on function public.cancel_job(uuid,integer) from public,anon,authenticated;
grant execute on function public.cancel_job(uuid,integer) to authenticated;
revoke all on function rebel_move_private.cancel_job(uuid,integer) from public,anon,authenticated;
grant execute on function rebel_move_private.cancel_job(uuid,integer) to authenticated;
create function public.revise_estimate(p_id uuid,p_revision integer) returns public.estimates language sql security invoker set search_path='' as $$ select rebel_move_private.revise_estimate(p_id,p_revision); $$;
revoke all on function public.revise_estimate(uuid,integer) from public,anon,authenticated;
grant execute on function public.revise_estimate(uuid,integer) to authenticated;
revoke all on function rebel_move_private.revise_estimate(uuid,integer) from public,anon,authenticated;
grant execute on function rebel_move_private.revise_estimate(uuid,integer) to authenticated;
create function public.mark_conversation_read(p_id uuid,p_message_id uuid) returns void language sql security invoker set search_path='' as $$ select rebel_move_private.mark_conversation_read(p_id,p_message_id); $$;
revoke all on function public.mark_conversation_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_conversation_read(uuid,uuid) to authenticated;
revoke all on function rebel_move_private.mark_conversation_read(uuid,uuid) from public,anon,authenticated;
grant execute on function rebel_move_private.mark_conversation_read(uuid,uuid) to authenticated;
create function public.unread_messages() returns bigint language sql security invoker set search_path='' as $$ select rebel_move_private.unread_messages(); $$;
revoke all on function public.unread_messages() from public,anon,authenticated;
grant execute on function public.unread_messages() to authenticated;
revoke all on function rebel_move_private.unread_messages() from public,anon,authenticated;
grant execute on function rebel_move_private.unread_messages() to authenticated;
create function public.assigned_customer_phone(p_job_id uuid) returns text language sql security invoker set search_path='' as $$ select rebel_move_private.assigned_customer_phone(p_job_id); $$;
revoke all on function public.assigned_customer_phone(uuid) from public,anon,authenticated;
grant execute on function public.assigned_customer_phone(uuid) to authenticated;
revoke all on function rebel_move_private.assigned_customer_phone(uuid) from public,anon,authenticated;
grant execute on function rebel_move_private.assigned_customer_phone(uuid) to authenticated;
create function public.resource_bookings(p_date date) returns table(job_id uuid,start_time time,end_time time,worker_ids uuid[],truck_id uuid) language sql security invoker set search_path='' as $$ select * from rebel_move_private.resource_bookings(p_date); $$;
revoke all on function public.resource_bookings(date) from public,anon,authenticated;
grant execute on function public.resource_bookings(date) to authenticated;
revoke all on function rebel_move_private.resource_bookings(date) from public,anon,authenticated;
grant execute on function rebel_move_private.resource_bookings(date) to authenticated;
commit;
