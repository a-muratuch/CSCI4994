-- Phase 7B scheduling context and turnaround setting. Fictional temporary
-- accounts only; every change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  customer_id uuid := gen_random_uuid();
  worker_id uuid := gen_random_uuid();
  off_worker uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  truck_id uuid;
  first_request uuid;
  second_request uuid;
  first_estimate uuid;
  second_estimate uuid;
  first_job uuid;
  cancelled_job uuid;
  third_request uuid;
  third_estimate uuid;
  day date := (now() at time zone 'America/Chicago')::date + 40;
  result jsonb;
  checks integer := 0;
  as_user text := 'request.jwt.claims';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (customer_id,customer_id::text||'@example.invalid','{}'),
    (worker_id,worker_id::text||'@example.invalid','{"full_name":"Travel Test Worker"}'),
    (off_worker,off_worker::text||'@example.invalid','{}'),
    (admin_id,admin_id::text||'@example.invalid','{}');
  update public.profiles set role='worker', full_name='Travel Test Worker' where id=worker_id;
  update public.profiles set role='worker' where id=off_worker;
  update public.profiles set role='admin' where id=admin_id;
  insert into public.worker_availability(worker_id,day,available,start_time,end_time)
    values (worker_id, extract(isodow from day)::integer, true, '07:00', '19:00'),
           (off_worker, extract(isodow from day)::integer, false, '07:00', '19:00');
  insert into public.trucks(name,capacity_cubic_feet) values ('Travel test truck',800) returning id into truck_id;

  -- Job A: Oxford → Memphis, 08:00–12:00. Job B's request: Oxford → Water Valley.
  insert into public.move_requests(customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,pickup_address,destination_address)
    values (customer_id,'1 A St, Oxford, MS 38655','2 B Ave, Memphis, TN 38103',day,'House','Studio','Boxes','None',
      '{"street":"1 A St","city":"Oxford","state":"MS","zip":"38655"}','{"street":"2 B Ave","city":"Memphis","state":"TN","zip":"38103"}')
    returning id into first_request;
  insert into public.move_requests(customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,pickup_address,destination_address)
    values (customer_id,'3 C St, Oxford, MS 38655','4 D Rd, Water Valley, MS 38965',day,'House','Studio','Boxes','None',
      '{"street":"3 C St","city":"Oxford","state":"MS","zip":"38655"}','{"street":"4 D Rd","city":"Water Valley","state":"MS","zip":"38965"}')
    returning id into second_request;
  insert into public.request_items(request_id,position,label,room,quantity,cubic_feet,weight_lb)
    values (second_request,1,'Box','Boxes',10,3,30),(second_request,2,'Sofa','Living room',1,50,350);
  insert into public.estimates(request_id,status,terms,created_by,published_at,decided_at,total_cents)
    values (first_request,'accepted','Terms',admin_id,now(),now(),10000) returning id into first_estimate;
  insert into public.estimates(request_id,status,terms,created_by,published_at,decided_at,total_cents)
    values (second_request,'accepted','Terms',admin_id,now(),now(),10000) returning id into second_estimate;
  insert into public.jobs(request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id)
    values (first_request,first_estimate,day,'08:00','12:00','08:00','09:00',truck_id) returning id into first_job;
  insert into public.job_workers(job_id,worker_id) values (first_job,worker_id);
  -- A cancelled job the same day must be ignored.
  insert into public.move_requests(customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details)
    values (customer_id,'5 E St','6 F St',day,'House','Studio','Boxes','None') returning id into third_request;
  insert into public.estimates(request_id,status,terms,created_by,published_at,decided_at,total_cents)
    values (third_request,'accepted','Terms',admin_id,now(),now(),10000) returning id into third_estimate;
  insert into public.jobs(request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id,status)
    values (third_request,third_estimate,day,'13:00','14:00','13:00','13:30',truck_id,'cancelled') returning id into cancelled_job;

  if (select public.scheduling_capabilities()) <> 8 then raise exception 'Capability missing'; end if;
  if (select turnaround_minutes from public.pricing_settings) <> 30 then raise exception 'Turnaround default'; end if;
  if has_function_privilege('anon','public.schedule_candidates(uuid,date,uuid,date)','EXECUTE') then raise exception 'Anon can read candidates'; end if;
  if to_regprocedure('public.save_pricing_settings(integer,integer,integer,numeric,integer,integer,numeric)') is not null
    then raise exception 'Old pricing function still exposed'; end if;
  checks := checks + 4;

  set local role authenticated;
  -- Customers and workers cannot read scheduling context.
  perform set_config(as_user,json_build_object('sub',customer_id,'role','authenticated')::text,true);
  begin perform public.schedule_candidates(second_estimate,day); raise exception 'Customer read candidates';
  exception when sqlstate '42501' then checks := checks + 1; end;
  perform set_config(as_user,json_build_object('sub',worker_id,'role','authenticated')::text,true);
  begin perform public.schedule_candidates(second_estimate,day); raise exception 'Worker read candidates';
  exception when sqlstate '42501' then checks := checks + 1; end;
  begin perform public.save_pricing_settings(4500,12500,40,2,200,35,1.2,30); raise exception 'Worker edited pricing';
  exception when sqlstate '42501' then checks := checks + 1; end;

  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  result := public.schedule_candidates(second_estimate,day);
  if result->>'pickupZip' <> '38655' or result->>'destinationPlace' <> 'Water Valley 38965' then raise exception 'This job places wrong: %', result; end if;
  if (result->>'volume')::numeric <> 80 then raise exception 'Volume wrong'; end if;
  checks := checks + 2;
  -- Same-day, non-cancelled jobs with the ZIPs needed for travel times.
  -- Only this test's job is checked: local browser fixtures may share the day.
  if (select count(*) from jsonb_array_elements(result->'jobs') j
      where j->>'id' = first_job::text
        and j->>'destinationZip' = '38103'
        and j->>'destinationPlace' = 'Memphis 38103'
        and j->>'end' = '12:00'
        and j->'workerIds' = jsonb_build_array(worker_id)
        and j->>'truckId' = truck_id::text) <> 1
    then raise exception 'Day jobs wrong: %', result->'jobs'; end if;
  checks := checks + 2;
  -- Worker availability and booked minutes; the unavailable worker is marked so.
  if not exists (select 1 from jsonb_array_elements(result->'workers') w
      where w->>'id' = worker_id::text and (w->>'available')::boolean and w->>'availableStart' = '07:00'
        and (w->>'weekMinutes')::integer = 240 and (w->>'fourWeekMinutes')::integer = 240)
    then raise exception 'Worker facts wrong: %', result->'workers'; end if;
  if not exists (select 1 from jsonb_array_elements(result->'workers') w where w->>'id' = off_worker::text and not (w->>'available')::boolean)
    then raise exception 'Unavailable worker missing'; end if;
  if not exists (select 1 from jsonb_array_elements(result->'trucks') t where t->>'id' = truck_id::text and (t->>'capacity')::integer = 800)
    then raise exception 'Truck missing'; end if;
  checks := checks + 3;
  -- Editing a job leaves its own booking out.
  result := public.schedule_candidates(first_estimate,day,first_job);
  if exists (select 1 from jsonb_array_elements(result->'jobs') j where j->>'id' = first_job::text)
    then raise exception 'Own job not excluded'; end if;
  if exists (select 1 from jsonb_array_elements(result->'workers') w where w->>'id' = worker_id::text and (w->>'weekMinutes')::integer <> 0)
    then raise exception 'Own minutes not excluded'; end if;
  checks := checks + 2;
  -- A different day has no jobs; an unknown estimate is refused.
  -- Other days may hold unrelated local browser fixtures; this day's job must not appear.
  if exists (select 1 from jsonb_array_elements(public.schedule_candidates(second_estimate,day+1)->'jobs') j
    where j->>'id' = first_job::text) then raise exception 'Other day leaked'; end if;
  begin perform public.schedule_candidates(gen_random_uuid(),day); raise exception 'Unknown estimate accepted';
  exception when sqlstate '22023' then checks := checks + 2; end;

  -- Turnaround is saved and range-checked.
  perform public.save_pricing_settings(4500,12500,40,2,200,35,1.2,45);
  if (select turnaround_minutes from public.pricing_settings) <> 45 then raise exception 'Turnaround not saved'; end if;
  begin perform public.save_pricing_settings(4500,12500,40,2,200,35,1.2,181); raise exception 'Turnaround over range';
  exception when sqlstate '22023' then checks := checks + 2; end;

  -- Deactivated administrators lose access.
  reset role;
  update public.profiles set active=false where id=admin_id;
  set local role authenticated;
  begin perform public.schedule_candidates(second_estimate,day); raise exception 'Inactive admin read candidates';
  exception when sqlstate '42501' then checks := checks + 1; end;

  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('scheduling-suggestions assertions completed');
select * from finish();
rollback;
