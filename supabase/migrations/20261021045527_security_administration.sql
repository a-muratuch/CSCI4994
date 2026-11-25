-- Phase 5: apply only after owner approval. Preserves existing records.
begin;
alter table public.profiles add column active boolean not null default true;
alter table public.trucks add column active boolean not null default true;
alter table public.move_requests add column client_request_id uuid not null default gen_random_uuid(),
 add column submission_fingerprint text;
create unique index move_request_retries on public.move_requests(customer_id,client_request_id);
create index request_rate_window on public.move_requests(customer_id,created_at);
create index message_rate_window on public.messages(sender_id,created_at);

create function rebel_move_private.active_account() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active);
$$;
revoke all on function rebel_move_private.active_account() from public,anon;
grant execute on function rebel_move_private.active_account() to authenticated;
create function rebel_move_private.require_active_account() returns void
language plpgsql security definer set search_path='' as $$
begin
 if not rebel_move_private.active_account() then raise exception 'Active account required' using errcode='42501';end if;
end $$;
revoke all on function rebel_move_private.require_active_account() from public,anon;
grant execute on function rebel_move_private.require_active_account() to authenticated;

create policy active_account_required on public.profiles as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.move_requests as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.estimates as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.estimate_items as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.estimate_events as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.jobs as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.job_workers as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.job_events as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.trucks as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.worker_availability as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.conversations as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.messages as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.request_events as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy active_account_required on public.conversation_reads as restrictive for all to authenticated
 using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));

-- Existing checked operations now reject inactive actors, including direct RPC calls.
CREATE OR REPLACE FUNCTION rebel_move_private.advance_job(p_job_id uuid, p_expected_status text, p_expected_revision integer)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); job_record public.jobs%rowtype; next_status text;
begin
 perform rebel_move_private.require_active_account();
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
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.can_read_conversation(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select rebel_move_private.active_account() and (select exists(select 1 from public.conversations c join public.profiles p on p.id=auth.uid()
 where c.id=p_id and (p.role='admin' or
 (c.kind='customer-support' and p.role='customer' and c.owner_id=p.id) or
 (c.kind='worker-support' and p.role='worker' and c.owner_id=p.id) or
 (c.kind='move-team' and rebel_move_private.can_read_job(c.job_id)))));
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.can_read_job(p_job_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select rebel_move_private.active_account() and (select exists(
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
  ));
$function$;

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
 perform rebel_move_private.require_active_account();
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

CREATE OR REPLACE FUNCTION rebel_move_private.get_conversation_people(p_conversation_id uuid)
 RETURNS TABLE(person_id uuid, full_name text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform rebel_move_private.require_active_account();
 if not rebel_move_private.can_read_conversation(p_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 return query select p.id,p.full_name,p.role from public.profiles p
 where p.role='admin' or exists(select 1 from public.conversations c where c.id=p_conversation_id and
 (c.owner_id=p.id or exists(select 1 from public.jobs j join public.move_requests r on r.id=j.request_id where j.id=c.job_id and r.customer_id=p.id)
 or exists(select 1 from public.job_workers w where w.job_id=c.job_id and w.worker_id=p.id)))
 or exists(select 1 from public.messages m where m.conversation_id=p_conversation_id and m.sender_id=p.id)
 order by p.full_name,p.id;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.get_job_team(p_job_id uuid)
 RETURNS TABLE(worker_id uuid, full_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform rebel_move_private.require_active_account();
  if not rebel_move_private.can_read_job(p_job_id) then
    raise exception 'This job is not available to this user.' using errcode='42501';
  end if;
  return query select p.id,p.full_name
    from public.job_workers w join public.profiles p on p.id=w.worker_id
    where w.job_id=p_job_id order by p.full_name,p.id;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select rebel_move_private.active_account() and (select exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.open_conversation(p_kind text, p_target_id uuid)
 RETURNS conversations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); actor_role text; target_role text; result public.conversations%rowtype;
begin
 perform rebel_move_private.require_active_account();
 select role into actor_role from public.profiles where id=actor;
 if actor_role is null then raise exception 'Sign in to open messages.' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('customer-support','worker-support','move-team') or p_target_id is null then raise exception 'Invalid conversation.' using errcode='22023';end if;
 if p_kind='move-team' then
  perform 1 from public.jobs where id=p_target_id for update;
  if not found or not rebel_move_private.can_read_job(p_target_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
  insert into public.conversations(kind,job_id) values(p_kind,p_target_id) on conflict(job_id) do nothing;
  select * into result from public.conversations where job_id=p_target_id;
 else
  select role into target_role from public.profiles where id=p_target_id;
  if target_role is distinct from (case when p_kind='customer-support' then 'customer' else 'worker' end)
   or (actor_role<>'admin' and actor<>p_target_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
  insert into public.conversations(kind,owner_id) values(p_kind,p_target_id) on conflict(kind,owner_id) do nothing;
  select * into result from public.conversations where kind=p_kind and owner_id=p_target_id;
 end if;
 return result;
end;
$function$;

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
 perform rebel_move_private.require_active_account();
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
 perform rebel_move_private.require_active_account();
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Administrator required' using errcode='42501'; end if;
  perform 1 from public.move_requests where id=(select request_id from public.estimates where id=p_estimate_id) for update;
  select * into saved from public.estimates where id=p_estimate_id for update;
  if not found or saved.revision is distinct from p_revision or saved.status <> 'draft' then raise exception 'Draft changed or published; review again' using errcode='40001'; end if;
  return rebel_move_private.publish_estimate(p_estimate_id);
end $function$;

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
 perform rebel_move_private.require_active_account();
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
 perform rebel_move_private.require_active_account();
  if actor is null or not rebel_move_private.is_admin() then
    raise exception 'Only administrators can schedule and assign jobs.' using errcode='42501';
  end if;
  perform 1 from public.profiles p join public.move_requests r on r.customer_id=p.id join public.estimates e on e.request_id=r.id where e.id=p_estimate_id and p.active for update of p;
  if not found then raise exception 'Active customer required' using errcode='22023';end if;
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
  if (select count(*) from public.profiles where id=any(p_worker_ids) and role='worker' and active)<>cardinality(p_worker_ids) then
    raise exception 'Choose existing worker accounts.' using errcode='22023'; end if;
  perform 1 from public.trucks where id=p_truck_id and active for update;
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

CREATE OR REPLACE FUNCTION rebel_move_private.save_worker_availability(p_days jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid();
begin
 perform rebel_move_private.require_active_account();
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
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.send_message(p_conversation_id uuid, p_body text, p_request_id uuid)
 RETURNS messages
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); conversation public.conversations%rowtype; result public.messages%rowtype; job_status text; clean_body text;
begin
 perform rebel_move_private.require_active_account();
 if actor is null then raise exception 'Sign in to send messages.' using errcode='42501';end if;
 select * into conversation from public.conversations where id=p_conversation_id;
 if not found then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 -- Same job lock as scheduling and completion: authorization is checked after waiting.
 if conversation.kind='move-team' then
  select status into job_status from public.jobs where id=conversation.job_id for update;
 end if;
 if not rebel_move_private.can_read_conversation(p_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 if conversation.kind='move-team' and job_status not in ('scheduled','in-progress') then raise exception 'This conversation is closed because the move is completed.' using errcode='22023';end if;
 clean_body:=regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g');
 if clean_body is null or char_length(clean_body) not between 1 and 2000 or p_request_id is null then raise exception 'Enter a message of 1–2000 characters and a request ID.' using errcode='22023';end if;
 insert into public.messages(conversation_id,sender_id,body,request_id) values(p_conversation_id,actor,clean_body,p_request_id)
 on conflict(sender_id,request_id) do nothing returning * into result;
 if result.id is null then
  select * into result from public.messages where sender_id=actor and request_id=p_request_id;
  if result.conversation_id<>p_conversation_id or result.body<>clean_body then raise exception 'Request ID already used for a different message.' using errcode='22023';end if;
 end if;
 return result;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.worker_can_read_request(p_request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select rebel_move_private.active_account() and (select exists(
    select 1 from public.jobs j
    join public.job_workers w on w.job_id=j.id
    join public.profiles p on p.id=w.worker_id
    where j.request_id=p_request_id and p.id=auth.uid() and p.role='worker'
  ));
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.cancel_job(p_id uuid,p_revision integer) returns public.jobs
language plpgsql security definer set search_path='' AS $$
declare saved public.jobs%rowtype;
begin
 perform rebel_move_private.require_active_account();
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into saved from public.jobs where id=p_id for update;
 if not found or saved.status<>'scheduled' or saved.revision is distinct from p_revision then
 raise exception 'Job changed or cannot be cancelled' using errcode='40001'; end if;
 update public.jobs set status='cancelled',revision=revision+1,updated_at=now() where id=p_id returning * into saved;
 insert into public.job_events(job_id,actor_id,action,details) values(p_id,auth.uid(),'cancelled',jsonb_build_object('revision',saved.revision));
 return saved;
end $$;

CREATE OR REPLACE FUNCTION rebel_move_private.revise_estimate(p_id uuid,p_revision integer) returns public.estimates
language plpgsql security definer set search_path='' AS $$
declare previous public.estimates%rowtype; saved public.estimates%rowtype;
begin
 perform rebel_move_private.require_active_account();
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

CREATE OR REPLACE FUNCTION rebel_move_private.mark_conversation_read(p_id uuid,p_message_id uuid) returns void
language plpgsql security definer set search_path='' AS $$
declare cutoff timestamptz;
begin
 perform rebel_move_private.require_active_account();
 if not rebel_move_private.can_read_conversation(p_id) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 select created_at into cutoff from public.messages where id=p_message_id and conversation_id=p_id;
 if not found then raise exception 'Message unavailable' using errcode='22023'; end if;
 insert into public.conversation_reads(conversation_id,user_id,read_at) values(p_id,auth.uid(),cutoff)
 on conflict(conversation_id,user_id) do update set read_at=greatest(public.conversation_reads.read_at,excluded.read_at);
end $$;

CREATE OR REPLACE FUNCTION rebel_move_private.assigned_customer_phone(p_job_id uuid) returns text
language plpgsql stable security definer set search_path='' AS $$
declare phone text;
begin
 perform rebel_move_private.require_active_account();
 if not exists(select 1 from public.job_workers w join public.profiles p on p.id=w.worker_id where w.job_id=p_job_id and w.worker_id=auth.uid() and p.role='worker') then
 raise exception 'Assigned worker required' using errcode='42501'; end if;
 select p.phone into phone from public.jobs j join public.move_requests r on r.id=j.request_id join public.profiles p on p.id=r.customer_id where j.id=p_job_id;
 return phone;
end $$;

CREATE OR REPLACE FUNCTION rebel_move_private.resource_bookings(p_date date) returns table(job_id uuid,start_time time,end_time time,worker_ids uuid[],truck_id uuid)
language plpgsql stable security definer set search_path='' AS $$
begin
 perform rebel_move_private.require_active_account();
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return query select j.id,j.start_time,j.end_time,array(select w.worker_id from public.job_workers w where w.job_id=j.id),j.truck_id
 from public.jobs j where j.scheduled_date=p_date and j.status<>'cancelled' order by j.start_time,j.id;
end $$;

CREATE OR REPLACE FUNCTION rebel_move_private.change_request(p_id uuid,p_revision integer,p_input jsonb,p_cancel boolean default false) returns public.move_requests
language plpgsql security definer set search_path='' AS $$
declare saved public.move_requests%rowtype; actor uuid:=auth.uid(); a jsonb; field text; retry_id uuid; fingerprint text;
begin
 perform rebel_move_private.require_active_account();
 if not exists(select 1 from public.profiles where id=actor and role='customer') then raise exception 'Customer required' using errcode='42501'; end if;
 if p_id is null then
  retry_id:=coalesce((p_input->>'_requestId')::uuid,gen_random_uuid());
  fingerprint:=encode(sha256(convert_to((p_input-'_requestId')::text,'UTF8')),'hex');
  perform 1 from public.profiles where id=actor and active for update;
  select * into saved from public.move_requests where customer_id=actor and client_request_id=retry_id;
  if found then
   if saved.submission_fingerprint is distinct from fingerprint then raise exception 'Request ID reused for different details' using errcode='22023';end if;
   return saved;
  end if;
 end if;
 if p_id is not null then
  select * into saved from public.move_requests where id=p_id for update;
  if not found or saved.customer_id<>actor then raise exception 'Request unavailable' using errcode='42501'; end if;
  if saved.revision is distinct from p_revision or saved.status<>'pending' or exists(select 1 from public.estimates where request_id=p_id and published_at is not null) then
   raise exception 'Request changed or estimate published' using errcode='40001'; end if;
  if p_cancel then
   update public.move_requests set status='cancelled',revision=revision+1 where id=p_id returning * into saved;
   insert into public.request_events(request_id,actor_id,action) values(p_id,actor,'cancelled');
   return saved;
  end if;
 elsif p_revision is distinct from 0 or p_cancel then raise exception 'Invalid request context' using errcode='22023'; end if;
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid request' using errcode='22023'; end if;
 foreach field in array array['pickup','destination','requestedDate','property','size','items','access','notes'] loop
  if jsonb_typeof(p_input->field) is distinct from 'string' then raise exception 'Invalid request field' using errcode='22023'; end if;
 end loop;
 if (p_input->>'requestedDate') !~ '^\d{4}-\d{2}-\d{2}$' or (p_input->>'requestedDate')::date < (now() at time zone 'America/Chicago')::date
 or p_input->>'property' not in ('House','Apartment','Townhouse','Other') then raise exception 'Invalid date or property' using errcode='22023'; end if;
 if p_id is null and (p_input->'pickupAddress' is null or p_input->'destinationAddress' is null) then raise exception 'Complete both addresses' using errcode='22023'; end if;
 foreach a in array array[p_input->'pickupAddress',p_input->'destinationAddress'] loop
  -- Legacy rows can still be edited with the unchanged free-text address.
  if a is not null and a<>'null'::jsonb then
   if jsonb_typeof(a) is distinct from 'object' then raise exception 'Invalid address' using errcode='22023'; end if;
   foreach field in array array['street','city','state','zip'] loop
    if jsonb_typeof(a->field) is distinct from 'string' or char_length(trim(a->>field)) not between 1 and 150 then raise exception 'Invalid address field' using errcode='22023'; end if;
   end loop;
   if (a->>'state') !~ '^[A-Z]{2}$' or (a->>'zip') !~ '^\d{5}(-\d{4})?$' then raise exception 'Invalid state or ZIP' using errcode='22023'; end if;
  end if;
 end loop;
 if p_input->'pickupAddress' is not null then a:=p_input->'pickupAddress';p_input:=jsonb_set(p_input,'{pickup}',to_jsonb(trim(a->>'street')||', '||trim(a->>'city')||', '||trim(a->>'state')||' '||trim(a->>'zip')));end if;
 if p_input->'destinationAddress' is not null then a:=p_input->'destinationAddress';p_input:=jsonb_set(p_input,'{destination}',to_jsonb(trim(a->>'street')||', '||trim(a->>'city')||', '||trim(a->>'state')||' '||trim(a->>'zip')));end if;
 if p_id is null then
  insert into public.move_requests(customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,notes,pickup_address,destination_address,client_request_id,submission_fingerprint)
  values(actor,trim(p_input->>'pickup'),trim(p_input->>'destination'),(p_input->>'requestedDate')::date,trim(p_input->>'property'),trim(p_input->>'size'),trim(p_input->>'items'),trim(p_input->>'access'),trim(p_input->>'notes'),p_input->'pickupAddress',p_input->'destinationAddress',retry_id,fingerprint) returning * into saved;
 else
  update public.move_requests set pickup=trim(p_input->>'pickup'),destination=trim(p_input->>'destination'),requested_date=(p_input->>'requestedDate')::date,
   property_type=trim(p_input->>'property'),move_size=trim(p_input->>'size'),items=trim(p_input->>'items'),access_details=trim(p_input->>'access'),notes=trim(p_input->>'notes'),
   pickup_address=p_input->'pickupAddress',destination_address=p_input->'destinationAddress',revision=revision+1 where id=p_id returning * into saved;
  insert into public.request_events(request_id,actor_id,action) values(p_id,actor,'edited');
 end if;
 return saved;
end $$;

CREATE OR REPLACE FUNCTION rebel_move_private.admin_records(p_kind text,p_search text default '',p_status text default '',p_sort text default 'newest',p_page integer default 1)
returns table(id uuid,request_id uuid,customer text,pickup text,destination text,record_date date,status text,created_at timestamptz,total_count bigint)
language plpgsql stable security definer set search_path='' AS $$
begin
 perform rebel_move_private.require_active_account();
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_kind not in ('requests','estimates','jobs') or p_sort not in ('newest','oldest','date','customer') or p_page not between 1 and 1000000 or char_length(p_search)>100 then raise exception 'Invalid filters' using errcode='22023'; end if;
 return query with records as (
 select r.id,r.id as request_id,p.full_name as customer,r.pickup,r.destination,r.requested_date as record_date,
 case when r.status='cancelled' then 'cancelled' when j.id is not null then j.status when e.status='awaiting' then 'estimate-ready' when e.status='accepted' then 'awaiting-scheduling' when e.status='declined' then 'coordinator-review' when e.status='draft' then 'estimate-draft' else 'requested' end as status,r.created_at
 from public.move_requests r join public.profiles p on p.id=r.customer_id
 left join public.estimates e on e.request_id=r.id and e.is_current left join public.jobs j on j.request_id=r.id where p_kind='requests'
 union all
 select e.id,r.id,p.full_name,r.pickup,r.destination,r.requested_date,e.status,e.created_at
 from public.estimates e join public.move_requests r on r.id=e.request_id join public.profiles p on p.id=r.customer_id where p_kind='estimates'
 union all
 select j.id,r.id,p.full_name,r.pickup,r.destination,j.scheduled_date,j.status,j.created_at
 from public.jobs j join public.move_requests r on r.id=j.request_id join public.profiles p on p.id=r.customer_id where p_kind='jobs'
 ), filtered as (select x.* from records x where (p_status='' or x.status=p_status)
 and (p_search='' or (x.customer||' '||x.pickup||' '||x.destination||' '||x.id::text) ilike '%'||replace(replace(replace(p_search,'\','\\'),'%','\%'),'_','\_')||'%'))
 select f.*,count(*) over() from filtered f order by
 case when p_sort='newest' then f.created_at end desc,
 case when p_sort='oldest' then f.created_at end asc,
 case when p_sort='date' then f.record_date end asc,
 case when p_sort='customer' then f.customer end asc,f.id limit 20 offset (p_page-1)*20;
end $$;

CREATE OR REPLACE FUNCTION rebel_move_private.admin_activity(p_kind text default '',p_action text default '',p_page integer default 1)
returns table(id uuid,entity text,record_id uuid,action text,actor text,occurred_at timestamptz,total_count bigint)
language plpgsql stable security definer set search_path='' AS $$
begin
 perform rebel_move_private.require_active_account();
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_kind not in ('','estimate','job') or p_page not between 1 and 1000000 or char_length(p_action)>40 then raise exception 'Invalid filters' using errcode='22023'; end if;
 return query with events as (
 select e.id,'estimate'::text as entity,e.estimate_id as record_id,e.new_status as action,p.full_name as actor,e.occurred_at from public.estimate_events e join public.profiles p on p.id=e.actor_id
 union all select e.id,'job',e.job_id,e.action,p.full_name,e.occurred_at from public.job_events e join public.profiles p on p.id=e.actor_id
 ),filtered as(select x.* from events x where (p_kind='' or x.entity=p_kind) and (p_action='' or x.action=p_action))
 select f.*,count(*) over() from filtered f order by f.occurred_at desc,f.id desc limit 20 offset (p_page-1)*20;
end $$;

-- Rate checks run inside creation functions through their INSERT triggers.
-- Profile row locks serialize per-account counts without process-local counters.
create function rebel_move_private.limit_creations() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid; used bigint;
begin
 if tg_table_name='messages' then actor:=new.sender_id;else actor:=new.customer_id;end if;
 if auth.uid() is null then return new;end if; -- trusted fixtures/maintenance only
 perform rebel_move_private.require_active_account();
 if actor is distinct from auth.uid() then raise exception 'Cannot create for another account' using errcode='42501';end if;
 perform 1 from public.profiles where id=actor for update;
 if tg_table_name='messages' then
  -- Idempotent message retries must still succeed at the quota boundary.
  if exists(select 1 from public.messages where sender_id=actor and request_id=new.request_id) then return new;end if;
  select count(*) into used from public.messages where sender_id=actor and created_at>clock_timestamp()-interval '1 minute';
  if used>=30 then raise exception 'Message rate exceeded' using errcode='P0001',hint='rate_limit';end if;
 else
  select count(*) into used from public.move_requests where customer_id=actor and created_at>clock_timestamp()-interval '10 minutes';
  if used>=5 then raise exception 'Request rate exceeded' using errcode='P0001',hint='rate_limit';end if;
 end if;
 new.created_at:=clock_timestamp();
 return new;
end $$;
revoke all on function rebel_move_private.limit_creations() from public,anon,authenticated;
create trigger request_rate before insert on public.move_requests for each row execute function rebel_move_private.limit_creations();
create trigger message_rate before insert on public.messages for each row execute function rebel_move_private.limit_creations();

create function rebel_move_private.set_account_active(p_id uuid,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare target public.profiles%rowtype;
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if p_id=auth.uid() or p_active is null then raise exception 'Cannot change your own access' using errcode='22023';end if;
 select * into target from public.profiles where id=p_id for update;
 if not found then raise exception 'Account unavailable' using errcode='22023';end if;
 -- Serializing administrator deactivation avoids concurrent removal of all administrators.
 if target.role='admin' then raise exception 'Administrator access changes require owner review' using errcode='22023';end if;
 if not p_active and exists(select 1 from public.jobs j join public.move_requests r on r.id=j.request_id
 where j.status in ('scheduled','in-progress') and (r.customer_id=p_id or exists(select 1 from public.job_workers w where w.job_id=j.id and w.worker_id=p_id))) then
 raise exception 'Reassign or close active jobs first' using errcode='22023';end if;
 update public.profiles set active=p_active where id=p_id;
end $$;
create function public.set_account_active(p_id uuid,p_active boolean) returns void
language sql security invoker set search_path='' as $$select rebel_move_private.set_account_active(p_id,p_active);$$;
revoke all on function public.set_account_active(uuid,boolean),rebel_move_private.set_account_active(uuid,boolean) from public,anon;
grant execute on function public.set_account_active(uuid,boolean),rebel_move_private.set_account_active(uuid,boolean) to authenticated;

create function rebel_move_private.save_truck(p_id uuid,p_name text,p_active boolean) returns public.trucks
language plpgsql security definer set search_path='' as $$
declare saved public.trucks%rowtype;
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if p_name is null or char_length(trim(p_name)) not between 1 and 100 or p_active is null then raise exception 'Invalid truck details' using errcode='22023';end if;
 if p_id is null then insert into public.trucks(name,active) values(trim(p_name),p_active) returning * into saved;
 else
  perform 1 from public.trucks where id=p_id for update;
  if not found then raise exception 'Truck unavailable' using errcode='22023';end if;
  if not p_active and exists(select 1 from public.jobs where truck_id=p_id and status in ('scheduled','in-progress')) then raise exception 'Reassign or close active jobs first' using errcode='22023';end if;
  update public.trucks set name=trim(p_name),active=p_active where id=p_id returning * into saved;
 end if;
 return saved;
end $$;
create function public.save_truck(p_id uuid,p_name text,p_active boolean) returns public.trucks
language sql security invoker set search_path='' as $$select rebel_move_private.save_truck(p_id,p_name,p_active);$$;
revoke all on function public.save_truck(uuid,text,boolean),rebel_move_private.save_truck(uuid,text,boolean) from public,anon;
grant execute on function public.save_truck(uuid,text,boolean),rebel_move_private.save_truck(uuid,text,boolean) to authenticated;

-- Worker roles are derived from an administrator-approved reservation, never user metadata.
create table rebel_move_private.worker_invitations (
 id uuid primary key default gen_random_uuid(), email text not null, full_name text not null,
 invited_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 consumed_by uuid references auth.users(id)
);
alter table rebel_move_private.worker_invitations enable row level security;
revoke all on rebel_move_private.worker_invitations from public,anon,authenticated;
create index worker_invitation_email on rebel_move_private.worker_invitations(email,created_at);
create index worker_invitation_issuer on rebel_move_private.worker_invitations(invited_by,created_at);
create function rebel_move_private.prepare_worker_invitation(p_email text,p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; target_email text:=lower(trim(p_email));
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 if target_email is null or char_length(target_email)>254 or target_email!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or p_name is null or char_length(trim(p_name)) not between 1 and 100 then raise exception 'Invalid invitation' using errcode='22023';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 perform pg_advisory_xact_lock(hashtextextended(target_email,0));
 if (select count(*) from rebel_move_private.worker_invitations where invited_by=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=10 then
 raise exception 'Invitation rate exceeded' using errcode='P0001',hint='rate_limit';end if;
 if exists(select 1 from auth.users u where lower(u.email)=target_email) then raise exception 'An account already exists; do not change its role' using errcode='22023';end if;
 if exists(select 1 from rebel_move_private.worker_invitations i where i.email=target_email and i.consumed_by is null and i.created_at>clock_timestamp()-interval '5 minutes') then
 raise exception 'Invitation already pending' using errcode='22023';end if;
 insert into rebel_move_private.worker_invitations(email,full_name,invited_by) values(target_email,trim(p_name),auth.uid()) returning id into result;
 return result;
end $$;
create function public.prepare_worker_invitation(p_email text,p_name text) returns uuid
language sql security invoker set search_path='' as $$select rebel_move_private.prepare_worker_invitation(p_email,p_name);$$;
revoke all on function public.prepare_worker_invitation(text,text),rebel_move_private.prepare_worker_invitation(text,text) from public,anon;
grant execute on function public.prepare_worker_invitation(text,text),rebel_move_private.prepare_worker_invitation(text,text) to authenticated;

CREATE OR REPLACE FUNCTION public.create_user_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
declare invitation rebel_move_private.worker_invitations%rowtype;
begin
 -- Pending invitations start inactive. Auth fills invited_at after INSERT.
 select i.* into invitation from rebel_move_private.worker_invitations i join public.profiles p on p.id=i.invited_by and p.role='admin' and p.active
 where i.email=lower(new.email) and i.consumed_by is null and i.created_at>clock_timestamp()-interval '5 minutes'
 order by i.created_at desc limit 1 for update of i;
 insert into public.profiles(id,full_name,role,active) values(new.id,
 case when invitation.id is not null then invitation.full_name else left(coalesce(new.raw_user_meta_data->>'full_name',''),100) end,
 'customer',invitation.id is null);
 return new;
end $$;

create function rebel_move_private.complete_worker_invitation(p_invitation uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare invitation rebel_move_private.worker_invitations%rowtype;
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501';end if;
 select * into invitation from rebel_move_private.worker_invitations where id=p_invitation and invited_by=auth.uid() for update;
 if not found then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if invitation.consumed_by is not null then
  if invitation.consumed_by=p_user then return;end if;
  raise exception 'Invitation already used' using errcode='22023';
 end if;
 if invitation.created_at<clock_timestamp()-interval '5 minutes' or not exists(
 select 1 from auth.users u where u.id=p_user and lower(u.email)=invitation.email and u.invited_at is not null and u.created_at>=invitation.created_at) then
 raise exception 'Verified new Auth invitation required' using errcode='22023';end if;
 perform 1 from public.profiles where id=p_user and role='customer' and not active for update;
 if not found then raise exception 'Pending account required; existing roles cannot change' using errcode='22023';end if;
 update public.profiles set role='worker',active=true,full_name=invitation.full_name where id=p_user;
 update rebel_move_private.worker_invitations set consumed_by=p_user where id=invitation.id;
end $$;
create function public.complete_worker_invitation(p_invitation uuid,p_user uuid) returns void
language sql security invoker set search_path='' as $$select rebel_move_private.complete_worker_invitation(p_invitation,p_user);$$;
revoke all on function public.complete_worker_invitation(uuid,uuid),rebel_move_private.complete_worker_invitation(uuid,uuid) from public,anon;
grant execute on function public.complete_worker_invitation(uuid,uuid),rebel_move_private.complete_worker_invitation(uuid,uuid) to authenticated;

create function public.security_capabilities() returns integer language sql stable security invoker set search_path='' as $$select 5;$$;
revoke all on function public.security_capabilities() from public,anon;
grant execute on function public.security_capabilities() to authenticated;
commit;
