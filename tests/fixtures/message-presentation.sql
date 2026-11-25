-- Disposable local browser fixtures only; never run against a hosted project.
begin;
do $$begin
 if not exists(select 1 from auth.users where id='10000000-0000-4000-8000-000000000003' and email='admin@example.invalid') then
  raise exception 'Expected disposable local seed is absent';end if;
end $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('41000000-0000-4000-8000-000000000001','chat-worker@example.invalid','{}'),
 ('41000000-0000-4000-8000-000000000002','chat-admin@example.invalid','{}')
on conflict(id) do nothing;
update public.profiles set role='worker',full_name='Alexandria Example with a long display name for wrapping checks' where id='41000000-0000-4000-8000-000000000001';
update public.profiles set role='admin',full_name='Morgan Example' where id='41000000-0000-4000-8000-000000000002';
insert into public.trucks(id,name) values('41000000-0000-4000-8000-000000000010','Chat fixture truck') on conflict(id) do nothing;

do $$declare n integer; r uuid; e uuid; j uuid; c uuid;
begin
 for n in 1..3 loop
  r:=('41000000-0000-4000-8000-00000000002'||n)::uuid;
  e:=('41000000-0000-4000-8000-00000000003'||n)::uuid;
  j:=('41000000-0000-4000-8000-00000000004'||n)::uuid;
  c:=('41000000-0000-4000-8000-00000000005'||n)::uuid;
  insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,created_at)
   values(r,'10000000-0000-4000-8000-000000000001','10 Chat Example Lane','20 Chat Example Road',current_date+n,'House','Studio','Boxes','Ground floor',now()-interval '1 day') on conflict(id) do nothing;
  insert into public.estimates(id,request_id,created_by,status,terms,published_at,decided_at,total_cents)
   values(e,r,'10000000-0000-4000-8000-000000000003','draft','Local chat fixture only',now(),now(),50000) on conflict(id) do update set status='draft';
  insert into public.estimate_items(estimate_id,position,label,amount_cents)
   values(e,1,'Local chat moving labor',50000) on conflict(estimate_id,position) do nothing;
  update public.estimates set status='accepted' where id=e;
  insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id,status)
   values(j,r,e,current_date+n,'09:00','12:00','09:00','10:00','41000000-0000-4000-8000-000000000010',case n when 1 then 'scheduled' when 2 then 'completed' else 'cancelled' end) on conflict(id) do nothing;
  insert into public.job_workers(job_id,worker_id) values(j,'10000000-0000-4000-8000-000000000002'),(j,'41000000-0000-4000-8000-000000000001') on conflict do nothing;
  insert into public.conversations(id,kind,job_id) values(c,'move-team',j) on conflict(id) do nothing;
 end loop;
end $$;

-- Previous runs may have months of history. Keep only this fixture's generated
-- history older than the five canonical messages; preserve every saved row.
update public.messages set created_at=least(created_at,now()-interval '3 days')
where conversation_id in ('41000000-0000-4000-8000-000000000051','41000000-0000-4000-8000-000000000052','41000000-0000-4000-8000-000000000053')
and request_id not in ('41000000-0000-4000-8000-000000000061','41000000-0000-4000-8000-000000000062','41000000-0000-4000-8000-000000000063','41000000-0000-4000-8000-000000000064','41000000-0000-4000-8000-000000000065');

insert into public.messages(conversation_id,sender_id,body,request_id,created_at) values
 ('41000000-0000-4000-8000-000000000051','41000000-0000-4000-8000-000000000002','Please share access instructions with the team.','41000000-0000-4000-8000-000000000061',now()-interval '1 day'),
 ('41000000-0000-4000-8000-000000000051','10000000-0000-4000-8000-000000000001',E'There are three steps at pickup.\nThe driveway will be clear.','41000000-0000-4000-8000-000000000062',now()-interval '23 hours'),
 ('41000000-0000-4000-8000-000000000051','10000000-0000-4000-8000-000000000002','Thanks. We will bring equipment for the steps.','41000000-0000-4000-8000-000000000063',now()-interval '22 hours'),
 ('41000000-0000-4000-8000-000000000051','41000000-0000-4000-8000-000000000001','Please keep the entrance clear for larger furniture.','41000000-0000-4000-8000-000000000064',now()-interval '21 hours'),
 ('41000000-0000-4000-8000-000000000052','10000000-0000-4000-8000-000000000002','The move is complete. Thank you.','41000000-0000-4000-8000-000000000065',now()-interval '20 hours')
on conflict(sender_id,request_id) do update set created_at=excluded.created_at;
commit;
