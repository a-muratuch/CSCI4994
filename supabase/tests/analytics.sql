-- Rollback-only metrics and access assertions; no hosted records are needed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
do $test$
declare
 a uuid:=gen_random_uuid();c uuid:=gen_random_uuid();w uuid:=gen_random_uuid();w2 uuid:=gen_random_uuid();t uuid:=gen_random_uuid();
 r1 uuid:=gen_random_uuid();r2 uuid:=gen_random_uuid();r3 uuid:=gen_random_uuid();r4 uuid:=gen_random_uuid();r5 uuid:=gen_random_uuid();r6 uuid:=gen_random_uuid();
 e1 uuid:=gen_random_uuid();e2 uuid:=gen_random_uuid();e4 uuid:=gen_random_uuid();j1 uuid:=gen_random_uuid();j4 uuid:=gen_random_uuid();
 first_day date:=date_trunc('week',now() at time zone 'America/Chicago')::date-49;
 monday date:=date_trunc('week',now() at time zone 'America/Chicago')::date;
 before_data jsonb;after_data jsonb;actor uuid;
begin
 insert into auth.users(id,email,raw_user_meta_data) select x,x::text||'@example.invalid','{}'::jsonb from unnest(array[a,c,w,w2]) x;
 update public.profiles set role='admin' where id=a;
 update public.profiles set role='worker',full_name='Analytics worker' where id=any(array[w,w2]);
 set local role authenticated;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 before_data:=public.admin_analytics(8);
 reset role;perform set_config('request.jwt.claims','{}',true);
 insert into public.trucks(id,name) values(t,'Analytics test truck');
 insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,created_at)
 select id,c,'10 Test Lane','20 Test Road',monday,'House','Studio','Boxes','Ground floor',created from (values
 (r1,now()),(r2,(first_day::timestamp at time zone 'America/Chicago')-interval '1 day'),(r3,now()),(r4,now()),(r5,now()),
 (r6,(first_day::timestamp at time zone 'America/Chicago')-interval '1 microsecond')) fixtures(id,created);
 update public.move_requests set status='cancelled' where id=r3;
 insert into public.estimates(id,request_id,created_by,status,terms,total_cents,published_at,decided_at)
 values(e1,r1,a,'accepted','Test',50000,now()-interval '1 hour',now()),
 (e2,r2,a,'accepted','Test',75000,now()-interval '1 hour',now()),
 (gen_random_uuid(),r5,a,'accepted','Test',99000,(first_day::timestamp at time zone 'America/Chicago')-interval '2 days',(first_day::timestamp at time zone 'America/Chicago')-interval '1 microsecond');
 insert into public.estimates(request_id,created_by,status,terms,total_cents,published_at,decided_at,version,is_current)
 values(r4,a,'declined','Test',10000,now()-interval '2 hours',now()-interval '1 hour',1,false);
 insert into public.estimates(id,request_id,created_by,status,terms,total_cents,published_at,decided_at,version)
 values(e4,r4,a,'accepted','Test',12500,now()-interval '30 minutes',now(),2);
 insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id,status)
 values(j1,r1,e1,monday,'09:00','12:00','09:00','10:00',t,'completed'),
 (gen_random_uuid(),r2,e2,monday,'13:00','17:00','13:00','14:00',t,'cancelled'),
 (j4,r4,e4,monday+1,'09:00','11:00','09:00','10:00',t,'scheduled');
 insert into public.job_workers(job_id,worker_id) values(j1,w),(j1,w2),(j4,w2);
 update public.profiles set active=false where id=w; -- Historical assignments remain reportable.
 set local role authenticated;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 after_data:=public.admin_analytics(8);
 if (after_data->>'requests')::int-(before_data->>'requests')::int<>4 then raise exception 'Cohort or CT boundary incorrect';end if;
 if (after_data->>'acceptedRequests')::int-(before_data->>'acceptedRequests')::int<>3 then raise exception 'Request conversion counted estimate versions';end if;
 if (after_data->>'acceptedCount')::int-(before_data->>'acceptedCount')::int<>3 or (after_data->>'acceptedCents')::bigint-(before_data->>'acceptedCents')::bigint<>137500 then raise exception 'Accepted value used request date, old version, or boundary';end if;
 if (after_data->>'jobs')::int-(before_data->>'jobs')::int<>2 then raise exception 'Cancelled job included';end if;
 if not exists(select 1 from jsonb_array_elements(after_data->'crew') x where x->>'id'=w::text and (x->>'hours')::numeric=3 and not (x->>'active')::boolean) then raise exception 'Inactive historical crew omitted';end if;
 if not exists(select 1 from jsonb_array_elements(after_data->'crew') x where x->>'id'=w2::text and (x->>'hours')::numeric=5 and (x->>'jobs')::int=2) then raise exception 'Shared crew hours incorrect';end if;
 if jsonb_array_length(public.admin_analytics(4)->'weekly')<>4 or jsonb_array_length(public.admin_analytics(12)->'weekly')<>12 then raise exception 'Period selection failed';end if;
 begin perform public.admin_analytics(999);raise exception 'Unbounded period accepted';exception when invalid_parameter_value then null;end;
 for actor in select x from unnest(array[c,w2,w]) x loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  begin perform public.admin_analytics(8);raise exception 'Non-admin analytics exposed';exception when insufficient_privilege then null;end;
  if exists(select 1 from public.analytics_requests) or exists(select 1 from public.analytics_jobs) or exists(select 1 from public.analytics_crew) then raise exception 'Analytics view bypassed role';end if;
 end loop;
 reset role;update public.profiles set active=false where id=a;
 set local role authenticated;perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 begin perform public.admin_analytics(8);raise exception 'Inactive admin analytics exposed';exception when insufficient_privilege then null;end;
 set local role anon;
 begin perform public.admin_analytics(8);raise exception 'Anonymous analytics allowed';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.analytics_requests;raise exception 'Anonymous view allowed';exception when insufficient_privilege then null;end;
end $test$;
select pass('Analytics periods, deduplication, accepted money, planned hours and role isolation');
select * from finish();
rollback;
