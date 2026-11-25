-- Repeatable integration journey using the same RPCs as the application.
-- All accounts, preferences, resources, requests and events are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  customer_actor uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid(); worker_id uuid := gen_random_uuid(); unassigned_id uuid := gen_random_uuid();
  requested_record uuid; truck_id uuid; estimate public.estimates%rowtype; job public.jobs%rowtype;
  checks integer := 0; initial_version integer; test_date date := (now() at time zone 'America/Chicago')::date + 14;
  pricing jsonb := '{"lines":[{"label":"Labor","amountCents":40000},{"label":"Transport","amountCents":12500}],"inclusions":["Two movers"],"exclusions":["Packing"],"terms":"Fictional test. Acceptance does not confirm a date."}';
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid','{}'::jsonb
    from unnest(array[customer_actor,other_id,admin_id,worker_id,unassigned_id]) x(id);
  update public.profiles set role='admin' where id=admin_id;
  update public.profiles set role='worker',full_name='Temporary Workflow Worker' where id=any(array[worker_id,unassigned_id]);
  set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',worker_id,'role','authenticated')::text,true);
  perform public.save_worker_availability((select jsonb_agg(jsonb_build_object('day',d,'available',true,'start_time','08:00','end_time','17:00')) from generate_series(1,7) x(d)));
  perform set_config('request.jwt.claims',json_build_object('sub',customer_actor,'role','authenticated')::text,true);
  insert into public.move_requests(pickup,destination,requested_date,property_type,move_size,items,access_details)
    values('101 Example Street','202 Example Avenue',test_date,'Apartment','Studio','Eight boxes','Ground floor') returning id into requested_record;
  if (select customer_id from public.move_requests where id=requested_record)<>customer_actor then raise exception 'Request owner mismatch'; end if; checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  estimate:=public.save_estimate_draft(requested_record,null,0,pricing);
  if estimate.request_id<>requested_record or estimate.status<>'draft' then raise exception 'Draft relationship mismatch'; end if; checks:=checks+1;
  estimate:=public.publish_reviewed_estimate(estimate.id,estimate.revision);
  if estimate.status<>'awaiting' or estimate.total_cents<>52500 then raise exception 'Published total mismatch'; end if; checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',customer_actor,'role','authenticated')::text,true);
  estimate:=public.decide_estimate(estimate.id,'accepted');
  if estimate.status<>'accepted' or exists(select 1 from public.jobs j where j.request_id=estimate.request_id) then raise exception 'Acceptance incorrectly scheduled a job'; end if; checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  insert into public.trucks(name) values('Temporary full-workflow truck') returning id into truck_id;
  job:=public.save_job(estimate.id,test_date,'09:00','12:00','09:00','10:00',array[worker_id],truck_id);
  if job.request_id<>estimate.request_id or job.estimate_id<>estimate.id or job.status<>'scheduled' then raise exception 'Job relationship mismatch'; end if; checks:=checks+1;
  initial_version:=job.revision;
  perform set_config('request.jwt.claims',json_build_object('sub',other_id,'role','authenticated')::text,true);
  if exists(select 1 from public.move_requests r where r.id=estimate.request_id) or exists(select 1 from public.estimates e where e.id=estimate.id) or exists(select 1 from public.jobs j where j.id=job.id) then raise exception 'Other customer can read the journey'; end if; checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',unassigned_id,'role','authenticated')::text,true);
  if exists(select 1 from public.jobs j where j.id=job.id) then raise exception 'Unassigned worker can read the job'; end if; checks:=checks+1;
  begin perform public.advance_job(job.id,'scheduled',initial_version);raise exception 'Unassigned progress allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',worker_id,'role','authenticated')::text,true);
  if (select count(*) from public.get_job_team(job.id))<>1 then raise exception 'Assigned team lookup failed'; end if; checks:=checks+1;
  job:=public.advance_job(job.id,'scheduled',initial_version);
  if job.status<>'in-progress' then raise exception 'Start failed'; end if; checks:=checks+1;
  begin perform public.advance_job(job.id,'scheduled',initial_version);raise exception 'Repeated start allowed';exception when serialization_failure then checks:=checks+1;end;
  -- Phase 8G: completion needs a delivery photo.
  perform public.add_move_photo(job.request_id,job.id,'delivery','image/png',1000);
  job:=public.advance_job(job.id,'in-progress',job.revision);
  if job.status<>'completed' or job.scheduled_date<>test_date or job.start_time<>'09:00'::time or job.end_time<>'12:00'::time or job.truck_id<>truck_id then raise exception 'Completion changed schedule'; end if; checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',customer_actor,'role','authenticated')::text,true);
  if not exists(select 1 from public.jobs j where j.id=job.id and j.status='completed') then raise exception 'Owner cannot see completion'; end if; checks:=checks+1;
  if (select count(*) from public.job_events e where e.job_id=job.id)<>3 or (select count(*) from public.estimate_events e where e.estimate_id=estimate.id)<>2 then raise exception 'Journey events duplicated or missing'; end if; checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  if not exists(select 1 from public.jobs j where j.id=job.id and j.status='completed') then raise exception 'Admin cannot see completion'; end if; checks:=checks+1;
  perform set_config('test.full_workflow_checks',checks::text,true);
end $test$;
select current_setting('test.full_workflow_checks')::integer as assertions_passed;
select pass('full-workflow assertions completed');
select * from finish();
rollback;
