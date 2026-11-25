-- Phase 8E: proposed appointments, booking on acceptance and day hints.
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
  wid2 uuid := gen_random_uuid();
  tid uuid;
  day date := (now() at time zone 'America/Chicago')::date + 20;
  req1 uuid := gen_random_uuid(); req2 uuid := gen_random_uuid(); req3 uuid := gen_random_uuid();
  est1 uuid := gen_random_uuid(); est2 uuid := gen_random_uuid(); est3 uuid := gen_random_uuid();
  other_job uuid := gen_random_uuid();
  outcome text;
  checks integer := 0;
  as_user text := 'request.jwt.claims';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (admin_id,admin_id::text||'@example.invalid','{}'),
    (wid,wid::text||'@example.invalid','{}'),
    (wid2,wid2::text||'@example.invalid','{}');
  update public.profiles set role='admin' where id=admin_id;
  update public.profiles set role='worker' where id in (wid,wid2);
  insert into public.worker_availability(worker_id,day,available,start_time,end_time)
    select w, d, true, '07:00', '20:00' from unnest(array[wid,wid2]) w, generate_series(1,7) d;
  insert into public.trucks(name) values ('Booking test truck') returning id into tid;
  insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details) values
    (req1,owner_id,'1 Book Lane','2 Book Court',day,'House','Studio','Boxes','None'),
    (req2,owner_id,'3 Book Lane','4 Book Court',day,'House','Studio','Boxes','None'),
    (req3,owner_id,'5 Book Lane','6 Book Court',day,'House','Studio','Boxes','None');
  insert into public.estimates(id,request_id,status,terms,created_by) values
    (est1,req1,'draft','Terms',admin_id),(est2,req2,'draft','Terms',admin_id),(est3,req3,'draft','Terms',admin_id);
  insert into public.estimate_items(estimate_id,position,label,amount_cents) values (est1,1,'Move',30000),(est2,1,'Move',30000),(est3,1,'Move',30000);

  if (select public.booking_capabilities()) <> 13 then raise exception 'Capability missing'; end if;
  if has_function_privilege('anon','public.day_availability(date,integer)','EXECUTE')
     or has_function_privilege('anon','public.accept_estimate(uuid)','EXECUTE')
     or has_table_privilege('authenticated','public.estimate_proposals','INSERT,UPDATE,DELETE')
    then raise exception 'Unexpected grant'; end if;
  checks := checks + 2;

  set local role authenticated;
  -- Customers cannot propose or read proposals.
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  begin perform public.set_estimate_proposal(est1,day,'09:00','12:00','09:00','10:00',array[wid],tid); raise exception 'Customer proposed';
  exception when sqlstate '42501' then checks := checks + 1; end;

  -- Administrator proposes on drafts; invalid slots are refused.
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform public.set_estimate_proposal(est1,day,'09:00','12:00','09:00','10:00',array[wid,wid2],tid);
  if (select row(proposed_date,proposed_arrival_start,proposed_arrival_end)::text from public.estimates where id=est1)
     <> row(day,'09:00'::time,'10:00'::time)::text then raise exception 'Proposal not mirrored'; end if;
  checks := checks + 1;
  begin perform public.set_estimate_proposal(est2,(now() at time zone 'America/Chicago')::date-1,'09:00','12:00','09:00','10:00',array[wid],tid); raise exception 'Past date accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.set_estimate_proposal(est2,day,'05:00','08:00','05:00','06:00',array[wid],tid); raise exception 'Unavailable hours accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.set_estimate_proposal(est2,day,'09:00','12:00','08:00','10:00',array[wid],tid); raise exception 'Arrival outside work accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  -- A later proposal on the same day for the same crew member and truck.
  perform public.set_estimate_proposal(est2,day,'13:00','16:00','13:00','14:00',array[wid],tid);

  -- Publish the first two.
  reset role;
  update public.estimates set status='awaiting',published_at=now(),total_cents=30000 where id in (est1,est2);
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  begin perform public.set_estimate_proposal(est1,null,null,null,null,null,null,null); raise exception 'Published proposal changed';
  exception when sqlstate '22023' then checks := checks + 1; end;

  -- Customer cannot read the full proposal, then accepts and the move is booked.
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  if exists (select 1 from public.estimate_proposals) then raise exception 'Customer reads proposals'; end if;
  outcome := public.accept_estimate(est1);
  if outcome <> 'booked' then raise exception 'First acceptance not booked: %', outcome; end if;
  if (select count(*) from public.jobs where request_id=req1 and scheduled_date=day and start_time='09:00' and truck_id=tid) <> 1
     or (select count(*) from public.job_workers w join public.jobs j on j.id=w.job_id where j.request_id=req1) <> 2
    then raise exception 'Booked job wrong'; end if;
  if not exists (select 1 from public.notifications n join public.jobs j on j.id=n.job_id
      where j.request_id=req1 and n.kind='job-scheduled' and n.recipient_id=owner_id)
    then raise exception 'Customer not notified of booking'; end if;
  checks := checks + 3;

  -- est2's crew has a new job since its proposal (est1's booking), so the
  -- travel check no longer holds: accepted only, an admin schedules it.
  outcome := public.accept_estimate(est2);
  if outcome <> 'accepted' or exists (select 1 from public.jobs where request_id=req2)
     or (select status from public.estimates where id=est2) <> 'accepted'
    then raise exception 'Changed day still booked: %', outcome; end if;
  checks := checks + 1;

  -- est3 is proposed after its neighbours exist; then one is rescheduled
  -- (revision change), which also prevents booking.
  reset role;
  insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id)
    values (other_job,req2,est2,day,'13:00','15:00','13:00','14:00',tid);
  insert into public.job_workers(job_id,worker_id) values (other_job,wid);
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform public.set_estimate_proposal(est3,day,'16:30','19:00','16:30','17:30',array[wid2],tid);
  if (select count(*) from public.estimate_proposals p, jsonb_object_keys(p.day_jobs) where p.estimate_id=est3) <> 2
    then raise exception 'Neighbours not recorded'; end if;
  checks := checks + 1;
  reset role;
  update public.estimates set status='awaiting',published_at=now(),total_cents=30000 where id=est3;
  update public.jobs set start_time='13:30', arrival_start='13:30', arrival_end='14:30', revision=revision+1 where id=other_job;
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  outcome := public.accept_estimate(est3);
  if outcome <> 'accepted' or exists (select 1 from public.jobs where request_id=req3)
    then raise exception 'Rescheduled neighbour still booked: %', outcome; end if;
  checks := checks + 1;
  begin perform public.accept_estimate(est3); raise exception 'Accepted twice';
  exception when sqlstate '22023' then checks := checks + 1; end;

  -- Day hints: statuses only, bounded range, today or later.
  if exists (select 1 from public.day_availability((now() at time zone 'America/Chicago')::date, 62) where status not in ('open','limited','full'))
    then raise exception 'Unexpected status'; end if;
  begin perform public.day_availability((now() at time zone 'America/Chicago')::date, 63); raise exception 'Long range accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.day_availability((now() at time zone 'America/Chicago')::date - 1, 5); raise exception 'Past range accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  checks := checks + 1;

  reset role;
  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('accept-to-book assertions completed');
select * from finish();
rollback;
