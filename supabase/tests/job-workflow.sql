-- Development integration test. All accounts and operational records roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  customer_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
  w1 uuid:=gen_random_uuid(); w2 uuid:=gen_random_uuid(); w3 uuid:=gen_random_uuid();
  truck1 uuid; truck2 uuid; request_ids uuid[]:='{}'; estimate_ids uuid[]:='{}';
  job1 uuid; job2 uuid; job3 uuid; rid uuid; i integer;
  test_date date:=(now() at time zone 'America/Chicago')::date+7;
  week jsonb; result public.jobs%rowtype; checks text[]:='{}';
begin
  insert into auth.users(id,email,raw_user_meta_data)
  select id,id::text||'@example.invalid','{}'::jsonb
  from unnest(array[customer_id,other_id,admin_id,w1,w2,w3]) as x(id);
  update public.profiles set role='admin' where id=admin_id;
  update public.profiles set role='worker' where id=any(array[w1,w2,w3]);
  update public.profiles set full_name='Test Worker' where id=any(array[w1,w2,w3]);
  select jsonb_agg(jsonb_build_object('day',d,'available',true,'start_time','08:00','end_time','17:00'))
    into week from generate_series(1,7) as x(d);
  set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',customer_id,'role','authenticated')::text,true);
  begin perform public.save_worker_availability(week); raise exception 'Unexpected success: Customer cannot save worker availability'; exception when sqlstate '42501' then checks:=array_append(checks,'Customer cannot save worker availability'); end;
  begin insert into public.trucks(name) values('Test truck'); raise exception 'Unexpected success: Customer cannot add trucks'; exception when sqlstate '42501' then checks:=array_append(checks,'Customer cannot add trucks'); end;
  for i in 1..12 loop
    insert into public.move_requests(pickup,destination,requested_date,property_type,move_size,items,access_details)
      values('12 Example Lane','25 Example Court',test_date,'Apartment','1 bedroom','10 boxes','Ground floor')
      returning id into rid;
    -- These are historical fixtures, not a burst of real customer submissions.
    reset role;
    update public.move_requests set created_at=now()-interval '1 day' where id=rid;
    set local role authenticated;
    request_ids:=array_append(request_ids,rid);
  end loop;
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  insert into public.trucks(name) values('Temporary Truck A') returning id into truck1;
  insert into public.trucks(name) values('Temporary Truck B') returning id into truck2;
  begin perform public.save_worker_availability(week); raise exception 'Unexpected success: Admin cannot impersonate worker availability'; exception when sqlstate '42501' then checks:=array_append(checks,'Admin cannot impersonate worker availability'); end;
  for i in 1..12 loop
    insert into public.estimates(request_id,inclusions,exclusions,terms)
      values(request_ids[i],array['Labor'],array['Packing supplies'],'Test estimate')
      returning id into rid;
    estimate_ids:=array_append(estimate_ids,rid);
    insert into public.estimate_items(estimate_id,position,label,amount_cents) values(rid,1,'Labor',65000);
    perform public.publish_estimate(rid);
  end loop;
  perform set_config('request.jwt.claims',json_build_object('sub',customer_id,'role','authenticated')::text,true);
  for i in 1..10 loop perform public.decide_estimate(estimate_ids[i],'accepted'); end loop;
  perform public.decide_estimate(estimate_ids[12],'declined');
  if not ((select count(*) from public.jobs where request_id=any(request_ids))=0) then raise exception 'Failed: Acceptance creates no jobs'; end if; checks:=array_append(checks,'Acceptance creates no jobs');
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Customer cannot schedule'; exception when sqlstate '42501' then checks:=array_append(checks,'Customer cannot schedule'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',w1,'role','authenticated')::text,true);
  perform public.save_worker_availability(week);
  if not ((select count(*) from public.worker_availability where worker_id=w1)=7) then raise exception 'Failed: Worker reads seven own availability days'; end if; checks:=array_append(checks,'Worker reads seven own availability days');
  begin perform public.save_worker_availability(week-0); raise exception 'Unexpected success: Six availability days rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Six availability days rejected'); end;
  begin perform public.save_worker_availability((week-0)||jsonb_build_array(week->1)); raise exception 'Unexpected success: Repeated day rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Repeated day rejected'); end;
  begin perform public.save_worker_availability(jsonb_set(week,'{0,day}','8')); raise exception 'Unexpected success: Invalid weekday rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Invalid weekday rejected'); end;
  begin perform public.save_worker_availability(jsonb_set(week,'{0,end_time}',to_jsonb('07:00'::text))); raise exception 'Unexpected success: Reversed availability rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Reversed availability rejected'); end;
  begin perform public.save_worker_availability(jsonb_set(week,'{0,start_time}',to_jsonb('08:00:01'::text))); raise exception 'Unexpected success: Availability seconds rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Availability seconds rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Worker cannot schedule'; exception when sqlstate '42501' then checks:=array_append(checks,'Worker cannot schedule'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',w2,'role','authenticated')::text,true); perform public.save_worker_availability(week);
  perform set_config('request.jwt.claims',json_build_object('sub',w3,'role','authenticated')::text,true); perform public.save_worker_availability(week);
  if not ((select count(*) from public.worker_availability where worker_id<>w3)=0) then raise exception 'Failed: Worker cannot read other availability'; end if; checks:=array_append(checks,'Worker cannot read other availability');
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  if not ((select count(*) from public.worker_availability where worker_id=any(array[w1,w2,w3]))=21) then raise exception 'Failed: Admin reads staff availability'; end if; checks:=array_append(checks,'Admin reads staff availability');
  if not ((select count(*) from public.profiles where id=any(array[w1,w2,w3]))=3) then raise exception 'Failed: Admin reads staff profiles'; end if; checks:=array_append(checks,'Admin reads staff profiles');
  begin perform public.save_job(estimate_ids[11],test_date,'09:00','12:00','09:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Awaiting estimate cannot schedule'; exception when sqlstate '22023' then checks:=array_append(checks,'Awaiting estimate cannot schedule'); end;
  begin perform public.save_job(estimate_ids[12],test_date,'09:00','12:00','09:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Declined estimate cannot schedule'; exception when sqlstate '22023' then checks:=array_append(checks,'Declined estimate cannot schedule'); end;
  begin perform public.save_job(gen_random_uuid(),test_date,'09:00','12:00','09:00','10:00',array[w1],truck1); raise exception 'Unexpected success: Unknown estimate rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Unknown estimate rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[]::uuid[],truck1,null,null); raise exception 'Unexpected success: Empty crew rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Empty crew rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[w1,w1],truck1,null,null); raise exception 'Unexpected success: Duplicate crew rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Duplicate crew rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[null]::uuid[],truck1,null,null); raise exception 'Unexpected success: Null worker rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Null worker rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[customer_id],truck1,null,null); raise exception 'Unexpected success: Customer cannot be assigned as worker'; exception when sqlstate '22023' then checks:=array_append(checks,'Customer cannot be assigned as worker'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[gen_random_uuid()],truck1,null,null); raise exception 'Unexpected success: Unknown worker rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Unknown worker rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[w1],gen_random_uuid(),null,null); raise exception 'Unexpected success: Unknown truck rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Unknown truck rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'07:00','12:00','07:00','12:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Unavailable interval rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Unavailable interval rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','08:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Arrival outside work rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Arrival outside work rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'12:00','09:00','12:00','09:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Reversed work rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Reversed work rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'22:00','02:00','22:00','02:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Overnight work rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Overnight work rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','24:00','09:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Midnight end rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Midnight end rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00:01','12:00','09:00:01','12:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Scheduling seconds rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Scheduling seconds rejected'); end;
  begin
    perform public.save_job(estimate_ids[1],'infinity','09:00','12:00','09:00','10:00',array[w1],truck1);
    raise exception 'Unexpected success: Infinite date rejected';
  exception when sqlstate '22023' then checks:=array_append(checks,'Infinite date rejected'); end;
  if not ((select count(*) from public.jobs where request_id=any(request_ids))=0 and (select count(*) from public.job_events e join public.jobs j on j.id=e.job_id where j.request_id=any(request_ids))=0) then raise exception 'Failed: Invalid schedules leave no partial records'; end if; checks:=array_append(checks,'Invalid schedules leave no partial records');
  select * into result from public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[w1,w2],truck1,null,null); job1:=result.id;
  if (select count(*) from public.get_job_teams(array[job1]))<>2 then raise exception 'Failed: Batch team names'; end if;
  begin perform * from public.get_job_teams(array[job1,null]); raise exception 'Unexpected success: Null batch job'; exception when sqlstate '42501' then null; end;
  if not (result.status='scheduled' and result.revision=1 and result.request_id=request_ids[1]) then raise exception 'Failed: Accepted estimate creates scheduled job'; end if; checks:=array_append(checks,'Accepted estimate creates scheduled job');
  if not ((select count(*) from public.job_workers where job_id=job1)=2) then raise exception 'Failed: Job and crew created together'; end if; checks:=array_append(checks,'Job and crew created together');
  if not (result.arrival_end='10:00'::time and result.end_time='12:00'::time) then raise exception 'Failed: Arrival distinct from work'; end if; checks:=array_append(checks,'Arrival distinct from work');
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Duplicate job rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Duplicate job rejected'); end;
  select * into result from public.save_job(estimate_ids[2],test_date,'12:00','14:00','12:00','14:00',array[w1],truck1,null,null); job2:=result.id;
  if not (result.id is not null) then raise exception 'Failed: Adjacent bookings allowed'; end if; checks:=array_append(checks,'Adjacent bookings allowed');
  select * into result from public.save_job(estimate_ids[3],test_date,'09:00','12:00','09:00','10:00',array[w3],truck2,null,null); job3:=result.id;
  if not (result.id is not null) then raise exception 'Failed: Separate resources can run concurrently'; end if; checks:=array_append(checks,'Separate resources can run concurrently');
  begin perform public.save_job(estimate_ids[4],test_date,'10:00','11:00','10:00','11:00',array[w2],truck2,null,null); raise exception 'Unexpected success: Worker overlap rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Worker overlap rejected'); end;
  begin perform public.save_job(estimate_ids[5],test_date,'12:00','13:00','12:00','13:00',array[w3],truck1,null,null); raise exception 'Unexpected success: Truck overlap rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Truck overlap rejected'); end;
  select * into result from public.save_job(estimate_ids[1],test_date,'09:00','11:00','09:00','10:00',array[w1,w2],truck1,job1,1);
  if not (result.revision=2 and result.end_time='11:00'::time) then raise exception 'Failed: Edit excludes own reservation'; end if; checks:=array_append(checks,'Edit excludes own reservation');
  select * into result from public.save_job(estimate_ids[1],test_date,'09:00','11:00','09:00','10:00',array[w2,w1],truck1,job1,2);
  if not (result.revision=2 and (select count(*) from public.job_events where job_id=job1)=2) then raise exception 'Failed: No-op save adds no revision or history'; end if; checks:=array_append(checks,'No-op save adds no revision or history');
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','11:00','09:00','10:00',array[w1,w2],truck1,job1,1); raise exception 'Unexpected success: Stale edit rejected'; exception when sqlstate '40001' then checks:=array_append(checks,'Stale edit rejected'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','13:00','09:00','10:00',array[w1,w2],truck1,job1,2); raise exception 'Unexpected success: Conflicting edit rejected'; exception when sqlstate '22023' then checks:=array_append(checks,'Conflicting edit rejected'); end;
  if not ((select revision=2 and end_time='11:00'::time from public.jobs where id=job1) and (select count(*) from public.job_workers where job_id=job1)=2 and (select count(*) from public.job_events where job_id=job1)=2) then raise exception 'Failed: Failed edit preserves records'; end if; checks:=array_append(checks,'Failed edit preserves records');
  select * into result from public.save_job(estimate_ids[3],test_date,'14:00','16:00','14:00','16:00',array[w3],truck2,job3,1);
  select * into result from public.save_job(estimate_ids[1],test_date,'09:00','11:00','09:00','10:00',array[w1,w3],truck1,job1,2);
  if not (result.revision=3 and (select count(*) from public.job_workers where job_id=job1 and worker_id=any(array[w1,w3]))=2 and not exists(select 1 from public.job_workers where job_id=job1 and worker_id=w2)) then raise exception 'Failed: Crew reassignment atomic'; end if; checks:=array_append(checks,'Crew reassignment atomic');
  perform set_config('request.jwt.claims',json_build_object('sub',other_id,'role','authenticated')::text,true);
  if not ((select count(*) from public.jobs)=0 and (select count(*) from public.job_workers)=0 and (select count(*) from public.job_events)=0 and (select count(*) from public.trucks)=0) then raise exception 'Failed: Other customer sees no jobs crews trucks or history'; end if; checks:=array_append(checks,'Other customer sees no jobs crews trucks or history');
  begin perform * from public.get_job_teams(array[job1]); raise exception 'Unexpected success: Other customer batch team access denied'; exception when sqlstate '42501' then null; end;
  begin perform * from public.get_job_team(job1); raise exception 'Unexpected success: Other customer team access denied';
    exception when sqlstate '42501' then checks:=array_append(checks,'Other customer team access denied'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',w2,'role','authenticated')::text,true);
  if not (not exists(select 1 from public.jobs where id=job1) and not exists(select 1 from public.move_requests where id=request_ids[1])) then raise exception 'Failed: Removed worker loses job and request access'; end if; checks:=array_append(checks,'Removed worker loses job and request access');
  begin perform public.advance_job(job1,'scheduled',3); raise exception 'Unexpected success: Unassigned worker cannot advance'; exception when sqlstate '42501' then checks:=array_append(checks,'Unassigned worker cannot advance'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',w1,'role','authenticated')::text,true);
  if not ((select count(*) from public.jobs where id=any(array[job1,job2,job3]))=2) then raise exception 'Failed: Worker sees only assigned jobs'; end if; checks:=array_append(checks,'Worker sees only assigned jobs');
  if not ((select count(*) from public.move_requests where id=any(request_ids))=2) then raise exception 'Failed: Worker sees assigned request details'; end if; checks:=array_append(checks,'Worker sees assigned request details');
  if (select count(*) from public.get_job_teams(array[job1]))<>2 then raise exception 'Failed: Worker sees assigned crew names'; end if;
  checks:=array_append(checks,'Worker sees assigned crew names');
  if exists(select 1 from public.profiles where id=w3) then raise exception 'Failed: Crew names do not expose coworker profile'; end if;
  checks:=array_append(checks,'Crew names do not expose coworker profile');
  if not ((select count(*) from public.trucks where id=any(array[truck1,truck2]))=1) then raise exception 'Failed: Worker sees only assigned truck'; end if; checks:=array_append(checks,'Worker sees only assigned truck');
  begin update public.jobs set start_time='08:00' where id=job1; raise exception 'Unexpected success: Direct scheduling writes denied'; exception when sqlstate '42501' then checks:=array_append(checks,'Direct scheduling writes denied'); end;
  begin insert into public.job_workers(job_id,worker_id) values(job3,w1); raise exception 'Unexpected success: Direct assignments denied'; exception when sqlstate '42501' then checks:=array_append(checks,'Direct assignments denied'); end;
  begin update public.worker_availability set available=false where worker_id=w1; raise exception 'Unexpected success: Direct availability writes denied'; exception when sqlstate '42501' then checks:=array_append(checks,'Direct availability writes denied'); end;
  perform public.save_worker_availability(
    (select jsonb_agg(jsonb_build_object('day',d,'available',false,'start_time','08:00','end_time','17:00'))
      from generate_series(1,7) as x(d)));
  if not ((select revision=3 and end_time='11:00'::time from public.jobs where id=job1)) then raise exception 'Failed: Availability preserves existing schedule'; end if; checks:=array_append(checks,'Availability preserves existing schedule');
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  begin perform public.save_job(estimate_ids[6],test_date,'16:00','17:00','16:00','17:00',array[w1],truck2,null,null); raise exception 'Unexpected success: Unavailable worker cannot receive new job'; exception when sqlstate '22023' then checks:=array_append(checks,'Unavailable worker cannot receive new job'); end;
  begin perform public.advance_job(job1,'scheduled',3); raise exception 'Unexpected success: Admin cannot advance progress'; exception when sqlstate '42501' then checks:=array_append(checks,'Admin cannot advance progress'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',customer_id,'role','authenticated')::text,true);
  if not ((select count(*) from public.jobs where request_id=any(request_ids))=3 and (select count(*) from public.job_events where job_id=job1)=3) then raise exception 'Failed: Owner reads jobs and history'; end if; checks:=array_append(checks,'Owner reads jobs and history');
  if (select count(*) from public.get_job_teams(array[job1]) where full_name='Test Worker')<>2 then raise exception 'Failed: Customer reads assigned crew names'; end if;
  checks:=array_append(checks,'Customer reads assigned crew names');
  begin perform public.advance_job(job1,'scheduled',3); raise exception 'Unexpected success: Customer cannot advance progress'; exception when sqlstate '42501' then checks:=array_append(checks,'Customer cannot advance progress'); end;
  begin insert into public.job_events(job_id,actor_id,action,details) values(job1,customer_id,'completed','{}'); raise exception 'Unexpected success: Forged history denied'; exception when sqlstate '42501' then checks:=array_append(checks,'Forged history denied'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',w1,'role','authenticated')::text,true); perform public.save_worker_availability(week);
  select * into result from public.advance_job(job1,'scheduled',3);
  if not (result.status='in-progress' and result.revision=4) then raise exception 'Failed: Assigned worker starts job'; end if; checks:=array_append(checks,'Assigned worker starts job');
  if not (result.end_time='11:00'::time and result.arrival_end='10:00'::time and result.truck_id=truck1) then raise exception 'Failed: Progress preserves schedule and truck'; end if; checks:=array_append(checks,'Progress preserves schedule and truck');
  begin perform public.advance_job(job1,'scheduled',3); raise exception 'Unexpected success: Repeated progress rejected'; exception when sqlstate '40001' then checks:=array_append(checks,'Repeated progress rejected'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','11:00','09:00','10:00',array[w1,w3],truck1,job1,4); raise exception 'Unexpected success: In-progress schedule edit denied'; exception when sqlstate '22023' then checks:=array_append(checks,'In-progress schedule edit denied'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',w3,'role','authenticated')::text,true);
  begin perform public.advance_job(job1,'scheduled',3); raise exception 'Unexpected success: Coworker stale progress rejected'; exception when sqlstate '40001' then checks:=array_append(checks,'Coworker stale progress rejected'); end;
  -- Phase 8G: completion needs a delivery photo.
  perform public.add_move_photo((select request_id from public.jobs where id=job1),job1,'delivery','image/png',1000);
  select * into result from public.advance_job(job1,'in-progress',4);
  if not (result.status='completed' and result.revision=5) then raise exception 'Failed: Assigned coworker completes job'; end if; checks:=array_append(checks,'Assigned coworker completes job');
  begin perform public.advance_job(job1,'completed',5); raise exception 'Unexpected success: Completed progress denied'; exception when sqlstate '22023' then checks:=array_append(checks,'Completed progress denied'); end;
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','11:00','09:00','10:00',array[w1,w3],truck1,job1,5); raise exception 'Unexpected success: Completed schedule edit denied'; exception when sqlstate '22023' then checks:=array_append(checks,'Completed schedule edit denied'); end;
  begin perform public.save_job(estimate_ids[4],test_date,'09:00','10:00','09:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Historical reservation blocks overlap'; exception when sqlstate '22023' then checks:=array_append(checks,'Historical reservation blocks overlap'); end;
  if not ((select count(*) from public.job_events where job_id=job1)=5) then raise exception 'Failed: History includes successful actions only'; end if; checks:=array_append(checks,'History includes successful actions only');
  if not ((select count(*) from public.job_events where job_id=job1 and action='in-progress' and actor_id=w1)=1 and (select count(*) from public.job_events where job_id=job1 and action='completed' and actor_id=w3)=1) then raise exception 'Failed: History records progress actors'; end if; checks:=array_append(checks,'History records progress actors');
  if not ((select requested_date=test_date from public.move_requests where id=request_ids[1])) then raise exception 'Failed: Requested date preserved'; end if; checks:=array_append(checks,'Requested date preserved');
  if not ((select count(*) from public.jobs where status='completed' and request_id=any(request_ids))=1) then raise exception 'Failed: Completed jobs remain available'; end if; checks:=array_append(checks,'Completed jobs remain available');
  set local role anon;
  begin perform * from public.get_job_team(job1); raise exception 'Unexpected success: Anonymous team access denied';
    exception when sqlstate '42501' then checks:=array_append(checks,'Anonymous team access denied'); end;
  begin perform count(*) from public.jobs; raise exception 'Unexpected success: Anonymous job reads denied'; exception when sqlstate '42501' then checks:=array_append(checks,'Anonymous job reads denied'); end;
  begin perform public.save_job(estimate_ids[1],test_date,'09:00','12:00','09:00','10:00',array[w1],truck1,null,null); raise exception 'Unexpected success: Anonymous scheduling denied'; exception when sqlstate '42501' then checks:=array_append(checks,'Anonymous scheduling denied'); end;
  begin perform public.advance_job(job1,'completed',5); raise exception 'Unexpected success: Anonymous progress denied'; exception when sqlstate '42501' then checks:=array_append(checks,'Anonymous progress denied'); end;
  begin perform public.save_worker_availability(week); raise exception 'Unexpected success: Anonymous availability denied'; exception when sqlstate '42501' then checks:=array_append(checks,'Anonymous availability denied'); end;
  reset role;
  perform set_config('test.job_checks',array_to_json(checks)::text,true);
end;
$test$;
select json_build_object('passed',json_array_length(current_setting('test.job_checks')::json),
  'checks',current_setting('test.job_checks')::json) as test_result;
select pass('job-workflow assertions completed');
select * from finish();
rollback;
