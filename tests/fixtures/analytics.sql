-- Local Docker browser fixture only; never execute against a hosted project.
begin;
do $$begin
 if not exists(select 1 from auth.users where id='10000000-0000-4000-8000-000000000003' and email='admin@example.invalid') then
  raise exception 'Expected disposable local seed is absent';end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values('30000000-0000-4000-8000-000000000001','analytics-worker@example.invalid','{}') on conflict(id) do nothing;
update public.profiles set role='worker',full_name='Alexandria Example with a long display name' where id='30000000-0000-4000-8000-000000000001';
insert into public.trucks(id,name) values('30000000-0000-4000-8000-000000000002','Analytics fixture truck') on conflict(id) do nothing;
insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details)
values('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10 Analytics Lane','20 Analytics Road',(now() at time zone 'America/Chicago')::date,'House','Studio','Boxes','Ground floor') on conflict(id) do nothing;
insert into public.estimates(id,request_id,created_by,status,terms,published_at,decided_at,total_cents)
values('30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','draft','Local browser fixture',now(),now(),9999999) on conflict(id) do update set status='draft',decided_at=excluded.decided_at;
insert into public.estimate_items(id,estimate_id,position,label,amount_cents)
values('30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000004',1,'Long description for the local analytics browser fixture moving services',9999999) on conflict(id) do nothing;
update public.estimates set status='accepted' where id='30000000-0000-4000-8000-000000000004';
insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id,status)
values('30000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004',date_trunc('week',now() at time zone 'America/Chicago')::date,'09:00','12:00','09:00','10:00','30000000-0000-4000-8000-000000000002','completed') on conflict(id) do update set scheduled_date=excluded.scheduled_date;
insert into public.job_workers(job_id,worker_id) values('30000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000001') on conflict do nothing;
commit;
