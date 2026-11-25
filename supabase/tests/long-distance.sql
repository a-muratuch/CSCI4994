-- Phase 9A: long-distance jobs occupy their crew and truck until the return day.
-- Fictional temporary accounts only; every change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  owner_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  w1 uuid := gen_random_uuid();
  w2 uuid := gen_random_uuid();
  t1 uuid; t2 uuid;
  d date := (now() at time zone 'America/Chicago')::date + 40;
  req uuid[] := '{}'; est uuid[] := '{}';
  long_job public.jobs%rowtype;
  job public.jobs%rowtype;
  result jsonb;
  outcome text;
  checks integer := 0;
  as_user text := 'request.jwt.claims';
  i integer;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (admin_id,admin_id::text||'@example.invalid','{}'),
    (w1,w1::text||'@example.invalid','{}'),
    (w2,w2::text||'@example.invalid','{}');
  update public.profiles set role='admin' where id=admin_id;
  update public.profiles set role='worker' where id in (w1,w2);
  -- w1 works every day; w2 is off on the day after d.
  insert into public.worker_availability(worker_id,day,available,start_time,end_time)
    select w1, x, true, '06:00'::time, '20:00'::time from generate_series(1,7) x
    union all
    select w2, x, x <> extract(isodow from d + 1)::integer, '06:00', '20:00' from generate_series(1,7) x;
  insert into public.trucks(name) values ('Long test truck 1') returning id into t1;
  insert into public.trucks(name) values ('Long test truck 2') returning id into t2;
  for i in 1..8 loop
    req := req || gen_random_uuid(); est := est || gen_random_uuid();
    insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details)
      values (req[i],owner_id,i||' Long Lane',i||' Far Court',d,'House','Studio','Boxes','None');
    insert into public.estimates(id,request_id,status,terms,created_by) values (est[i],req[i],'draft','Terms',admin_id);
    insert into public.estimate_items(estimate_id,position,label,amount_cents) values (est[i],1,'Move',30000);
  end loop;
  -- 1–7 accepted for scheduling; 8 stays a draft for the proposal check.
  update public.estimates set status='accepted',published_at=now(),decided_at=now(),total_cents=30000 where id = any(est[1:7]);

  if (select public.long_distance_capabilities()) <> 15 then raise exception 'Capability missing'; end if;
  checks := checks + 1;

  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);

  -- Invalid date combinations are refused.
  begin perform public.save_job(est[1],d,'08:00','18:00','08:00','10:00',array[w1],t1,null,null,d+1,null); raise exception 'Multi-day without return accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.save_job(est[1],d,'08:00','18:00','08:00','10:00',array[w1],t1,null,null,d+2,d+1); raise exception 'Return before delivery accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.save_job(est[1],d,'08:00','18:00','07:00','10:00',array[w1],t1,null,null,d+1,d+3); raise exception 'Arrival before start accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  -- w2 is off on d+1, so cannot take a trip through that day.
  begin perform public.save_job(est[1],d,'08:00','18:00','08:00','10:00',array[w2],t1,null,null,d+1,d+3); raise exception 'Unavailable day accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;

  -- A long-distance job: delivers d+1 at 18:00 (earlier than its start time is fine), back on d+3.
  long_job := public.save_job(est[1],d,'08:00','18:00','08:00','10:00',array[w1],t1,null,null,d+1,d+3);
  if long_job.end_date <> d+1 or long_job.return_date <> d+3 then raise exception 'Dates not saved'; end if;
  if (select details->>'return_date' from public.job_events where job_id=long_job.id) <> (d+3)::text then raise exception 'Event lacks dates'; end if;
  checks := checks + 2;

  -- The crew and truck are away through the return day...
  begin perform public.save_job(est[2],d+2,'09:00','11:00','09:00','10:00',array[w1],t2); raise exception 'Crew booked during return';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.save_job(est[2],d+3,'15:00','17:00','15:00','16:00',array[w2],t1); raise exception 'Truck booked on return day';
  exception when sqlstate '22023' then checks := checks + 1; end;
  -- ...but free before the start and the day after the return.
  job := public.save_job(est[2],d,'06:00','07:30','06:00','07:00',array[w1],t2);
  job := public.save_job(est[3],d+4,'08:00','10:00','08:00','09:00',array[w1],t1);
  checks := checks + 2;

  -- Same-day jobs still behave as before.
  begin perform public.save_job(est[4],d+4,'09:00','11:00','09:00','10:00',array[w1],t2); raise exception 'Same-day overlap accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  job := public.save_job(est[4],d+4,'10:00','12:00','10:00','11:00',array[w1],t2);
  begin perform public.save_job(est[5],d+5,'09:00','11:00','09:00','10:00',array[w1],t2,null,null,d+6,null); raise exception 'Same-day job with later delivery accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  checks := checks + 1;

  -- Bookings for a middle day show the long job for the whole day.
  if not exists (select 1 from public.resource_bookings(d+2) b where b.job_id=long_job.id and b.start_time='00:00' and b.end_time='23:59')
    then raise exception 'Booking for a middle day missing'; end if;
  -- Suggestions list it as away, not as a same-day neighbour.
  result := public.schedule_candidates(est[6],d+2,null,d+2);
  if not exists (select 1 from jsonb_array_elements(result->'away') a where a->>'id'=long_job.id::text and a->>'until'=(d+3)::text)
     or exists (select 1 from jsonb_array_elements(result->'jobs') j where j->>'id'=long_job.id::text)
    then raise exception 'Away list wrong: %', result; end if;
  if (select (w->>'fourWeekMinutes')::integer from jsonb_array_elements(result->'workers') w where w->>'id'=w1::text) < 2400
    then raise exception 'Multi-day workload not counted'; end if;
  checks := checks + 3;

  -- Editing the trip to return a day earlier frees d+3 for the truck.
  long_job := public.save_job(est[1],d,'08:00','18:00','08:00','10:00',array[w1],t1,long_job.id,long_job.revision,d+1,d+2);
  job := public.save_job(est[6],d+3,'15:00','17:00','15:00','16:00',array[w2],t1);
  checks := checks + 1;

  -- Proposals carry the dates and booking on acceptance creates the same span.
  perform public.set_estimate_proposal(est[8],d+10,'08:00','18:00','08:00','10:00',array[w1],t1,d+11,d+13);
  if (select row(end_date,return_date)::text from public.estimate_proposals where estimate_id=est[8]) <> row(d+11,d+13)::text
    then raise exception 'Proposal dates not saved'; end if;
  reset role;
  update public.estimates set status='awaiting',published_at=now(),total_cents=30000 where id=est[8];
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  outcome := public.accept_estimate(est[8]);
  if outcome <> 'booked' or not exists (select 1 from public.jobs where request_id=req[8] and end_date=d+11 and return_date=d+13)
    then raise exception 'Long-distance booking failed: %', outcome; end if;
  checks := checks + 2;

  reset role;
  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('long-distance assertions completed');
select * from finish();
rollback;
