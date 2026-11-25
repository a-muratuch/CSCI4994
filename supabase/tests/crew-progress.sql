-- Phase 8G: on the way, arrived, delivery photo before completion, the
-- administrator waiver and progress notifications.
-- Fictional temporary accounts only; every change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  owner_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  wid uuid := gen_random_uuid();
  other_worker uuid := gen_random_uuid();
  tid uuid;
  today date := (now() at time zone 'America/Chicago')::date;
  req1 uuid := gen_random_uuid(); req2 uuid := gen_random_uuid(); req3 uuid := gen_random_uuid();
  est1 uuid := gen_random_uuid(); est2 uuid := gen_random_uuid(); est3 uuid := gen_random_uuid();
  job1 uuid := gen_random_uuid(); job2 uuid := gen_random_uuid(); job3 uuid := gen_random_uuid();
  job public.jobs%rowtype;
  snapshot jsonb;
  checks integer := 0;
  as_user text := 'request.jwt.claims';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (admin_id,admin_id::text||'@example.invalid','{}'),
    (wid,wid::text||'@example.invalid','{}'),
    (other_worker,other_worker::text||'@example.invalid','{}');
  update public.profiles set role='admin' where id=admin_id;
  update public.profiles set role='worker' where id in (wid,other_worker);
  insert into public.trucks(name) values ('Progress test truck') returning id into tid;
  insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details) values
    (req1,owner_id,'1 Progress Lane','2 Progress Court',today+1,'House','Studio','Boxes','None'),
    (req2,owner_id,'3 Progress Lane','4 Progress Court',today+1,'House','Studio','Boxes','None'),
    (req3,owner_id,'5 Progress Lane','6 Progress Court',today+1,'House','Studio','Boxes','None');
  insert into public.estimates(id,request_id,status,terms,created_by) values
    (est1,req1,'draft','Terms',admin_id),(est2,req2,'draft','Terms',admin_id),(est3,req3,'draft','Terms',admin_id);
  insert into public.estimate_items(estimate_id,position,label,amount_cents) values (est1,1,'Move',30000),(est2,1,'Move',30000),(est3,1,'Move',30000);
  update public.estimates set status='accepted',published_at=now(),decided_at=now(),total_cents=30000 where id in (est1,est2,est3);
  -- job1 today, job2 tomorrow, job3 cancelled.
  insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id,status) values
    (job1,req1,est1,today,'08:00','10:00','08:00','09:00',tid,'scheduled'),
    (job2,req2,est2,today+1,'08:00','10:00','08:00','09:00',tid,'scheduled'),
    (job3,req3,est3,today+2,'08:00','10:00','08:00','09:00',tid,'cancelled');
  insert into public.job_workers(job_id,worker_id) values (job1,wid),(job2,wid),(job3,wid);

  if (select public.crew_progress_capabilities()) <> 14 then raise exception 'Capability missing'; end if;
  if has_function_privilege('anon','public.mark_on_the_way(uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.waive_delivery_photo(uuid,text)','EXECUTE') then raise exception 'Anonymous execute allowed'; end if;
  checks := checks + 2;

  set local role authenticated;
  -- On the way: assigned worker, moving day, once, current revision.
  perform set_config(as_user,json_build_object('sub',other_worker,'role','authenticated')::text,true);
  begin perform public.mark_on_the_way(job1,1); raise exception 'Unassigned worker marked on the way';
  exception when sqlstate '42501' then checks := checks + 1; end;
  perform set_config(as_user,json_build_object('sub',wid,'role','authenticated')::text,true);
  begin perform public.mark_on_the_way(job1,9); raise exception 'Stale revision accepted';
  exception when sqlstate '40001' then checks := checks + 1; end;
  begin perform public.mark_on_the_way(job2,1); raise exception 'Marked on the way before the moving day';
  exception when sqlstate '22023' then checks := checks + 1; end;
  job := public.mark_on_the_way(job1,1);
  if job.on_the_way_at is null or job.status <> 'scheduled' or job.revision <> 2 then raise exception 'On the way not saved'; end if;
  begin perform public.mark_on_the_way(job1,2); raise exception 'Marked on the way twice';
  exception when sqlstate '22023' then checks := checks + 1; end;
  checks := checks + 1;

  -- Arrived starts the job; completion needs a delivery photo.
  job := public.advance_job(job1,'scheduled',2);
  if job.status <> 'in-progress' then raise exception 'Arrival failed'; end if;
  begin perform public.advance_job(job1,'in-progress',3); raise exception 'Completed without a delivery photo';
  exception when sqlstate '22023' then checks := checks + 1; end;
  perform public.add_move_photo(req1,job1,'pickup','image/png',1000);
  begin perform public.advance_job(job1,'in-progress',3); raise exception 'A pickup photo allowed completion';
  exception when sqlstate '22023' then checks := checks + 1; end;
  perform public.add_move_photo(req1,job1,'delivery','image/png',1000);
  perform public.add_move_photo(req1,job1,'delivery','image/png',1000);
  job := public.advance_job(job1,'in-progress',3);
  if job.status <> 'completed' then raise exception 'Completion with photo failed'; end if;
  checks := checks + 2;

  -- Customer notifications: on the way, arrived, one delivery-photos alert.
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  if (select count(*) from public.notifications where job_id=job1 and kind='crew-on-the-way') <> 1
     or (select count(*) from public.notifications where job_id=job1 and kind='crew-arrived') <> 1
     or (select count(*) from public.notifications where job_id=job1 and kind='delivery-photos') <> 1
    then raise exception 'Customer progress notifications wrong'; end if;
  snapshot := public.notification_snapshot(false,1);
  if not exists (select 1 from jsonb_array_elements(snapshot->'items') i
      where i->>'title'='Your crew is on the way' and i->>'target_kind'='move' and i->>'target_id'=req1::text)
    then raise exception 'Snapshot title missing'; end if;
  checks := checks + 2;
  -- Administrators get the delivery-photos alert, workers do not.
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  if (select count(*) from public.notifications where job_id=job1 and kind='delivery-photos') <> 1
    then raise exception 'Admin delivery alert missing'; end if;
  perform set_config(as_user,json_build_object('sub',wid,'role','authenticated')::text,true);
  if exists (select 1 from public.notifications where job_id=job1 and kind in ('crew-on-the-way','crew-arrived','delivery-photos'))
    then raise exception 'Worker received customer alerts'; end if;
  checks := checks + 2;

  -- Waiver: administrators only, once, open jobs only; then completion works.
  begin perform public.waive_delivery_photo(job2,'Phone broken'); raise exception 'Worker waived photo';
  exception when sqlstate '42501' then checks := checks + 1; end;
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  begin perform public.waive_delivery_photo(job1,null); raise exception 'Completed job waived';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.waive_delivery_photo(job2,repeat('x',201)); raise exception 'Long note accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  perform public.waive_delivery_photo(job2,'  Phone broken  ');
  if (select photo_waiver_note from public.jobs where id=job2) <> 'Phone broken' then raise exception 'Waiver not saved'; end if;
  begin perform public.waive_delivery_photo(job2,null); raise exception 'Waived twice';
  exception when sqlstate '22023' then checks := checks + 1; end;
  perform set_config(as_user,json_build_object('sub',wid,'role','authenticated')::text,true);
  job := public.advance_job(job2,'scheduled',2);
  job := public.advance_job(job2,'in-progress',3);
  if job.status <> 'completed' then raise exception 'Waived job did not complete'; end if;
  checks := checks + 2;

  -- Cancelled jobs cannot advance (previously they could be completed).
  begin perform public.advance_job(job3,'cancelled',1); raise exception 'Cancelled job advanced';
  exception when sqlstate '22023' then checks := checks + 1; end;

  reset role;
  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('crew-progress assertions completed');
select * from finish();
rollback;
