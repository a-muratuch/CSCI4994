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
  a2 uuid:=gen_random_uuid(); conversation public.conversations%rowtype; support public.conversations%rowtype; worker_support public.conversations%rowtype; message public.messages%rowtype; retry uuid:=gen_random_uuid(); checks integer := 0; initial_version integer; test_date date := (now() at time zone 'America/Chicago')::date + 14;
  pricing jsonb := '{"lines":[{"label":"Labor","amountCents":40000},{"label":"Transport","amountCents":12500}],"inclusions":["Two movers"],"exclusions":["Packing"],"terms":"Fictional test. Acceptance does not confirm a date."}';
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid','{}'::jsonb
    from unnest(array[customer_actor,other_id,admin_id,a2,worker_id,unassigned_id]) x(id);
  update public.profiles set role='admin' where id=any(array[admin_id,a2]);
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

  begin perform public.open_conversation('invalid',customer_actor);raise exception 'Invalid kind';exception when sqlstate '22023' then checks:=checks+1;end;
  begin perform public.open_conversation('customer-support',worker_id);raise exception 'Wrong target role';exception when insufficient_privilege then checks:=checks+1;end;
  support:=public.open_conversation('customer-support',customer_actor);
  if public.open_conversation('customer-support',customer_actor)<>support then raise exception 'Duplicate support conversation';end if;checks:=checks+1;
  worker_support:=public.open_conversation('worker-support',worker_id);
  conversation:=public.open_conversation('move-team',job.id);
  if (public.open_conversation('move-team',job.id)).id<>conversation.id then raise exception 'Duplicate team';end if;checks:=checks+1;
  message:=public.send_message(support.id,'  Hello  ',retry);
  if message.sender_id<>admin_id or message.body<>'Hello' or message.created_at is null then raise exception 'Message identity/trim/timestamp';end if;checks:=checks+1;
  if (public.send_message(support.id,'Hello',retry)).id<>message.id then raise exception 'Retry duplicated';end if;checks:=checks+1;
  begin perform public.send_message(support.id,'Different',retry);raise exception 'Mismatched retry allowed';exception when sqlstate '22023' then checks:=checks+1;end;
  begin perform public.send_message(worker_support.id,'Hello',retry);raise exception 'Cross conversation retry allowed';exception when sqlstate '22023' then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',a2,'role','authenticated')::text,true);
  perform public.send_message(support.id,'Second administrator',gen_random_uuid());
  perform public.send_message(worker_support.id,'Worker support',gen_random_uuid());
  perform public.send_message(conversation.id,'Team admin',gen_random_uuid());checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',customer_actor,'role','authenticated')::text,true);
  perform public.send_message(support.id,'Customer reply',gen_random_uuid());
  perform public.send_message(conversation.id,'Team customer',gen_random_uuid());checks:=checks+1;
  if exists(select 1 from public.conversations where id=worker_support.id) then raise exception 'Customer reads worker support';end if;checks:=checks+1;
  begin perform public.open_conversation('worker-support',worker_id);raise exception 'Customer opens worker support';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.open_conversation('customer-support',other_id);raise exception 'Other customer support';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.send_message(worker_support.id,'Forbidden',gen_random_uuid());raise exception 'Cross support send';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.send_message(support.id,E' \n\t ',gen_random_uuid());raise exception 'Blank accepted';exception when sqlstate '22023' then checks:=checks+1;end;
  begin perform public.send_message(support.id,repeat('x',2001),gen_random_uuid());raise exception 'Oversize accepted';exception when sqlstate '22023' then checks:=checks+1;end;
  begin perform public.send_message(support.id,null,gen_random_uuid());raise exception 'Null body accepted';exception when sqlstate '22023' then checks:=checks+1;end;
  begin perform public.send_message(support.id,'Valid',null);raise exception 'Null request accepted';exception when sqlstate '22023' then checks:=checks+1;end;
  perform public.send_message(support.id,repeat('x',2000),gen_random_uuid());checks:=checks+1;
  begin insert into public.messages(conversation_id,sender_id,body,request_id) values(support.id,a2,'Forged',gen_random_uuid());raise exception 'Direct insert';exception when insufficient_privilege then checks:=checks+1;end;
  begin update public.messages set body='Changed' where id=message.id;raise exception 'Direct update';exception when insufficient_privilege then checks:=checks+1;end;
  begin delete from public.messages where id=message.id;raise exception 'Direct delete';exception when insufficient_privilege then checks:=checks+1;end;
  begin insert into public.conversations(kind,owner_id) values('customer-support',other_id);raise exception 'Direct conversation';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',worker_id,'role','authenticated')::text,true);
  if (public.open_conversation('worker-support',worker_id)).id<>worker_support.id then raise exception 'Own worker support';end if;checks:=checks+1;
  perform public.send_message(worker_support.id,'Worker reply',gen_random_uuid());
  perform public.send_message(conversation.id,'Worker team',gen_random_uuid());checks:=checks+1;
  if exists(select 1 from public.messages where conversation_id=support.id) then raise exception 'Worker reads customer support';end if;checks:=checks+1;
  if (select count(*) from public.get_conversation_people(conversation.id) where person_id=any(array[admin_id,a2,customer_actor,worker_id]))<>4 then raise exception 'Safe participant names';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',unassigned_id,'role','authenticated')::text,true);
  if exists(select 1 from public.conversations where id=worker_support.id) then raise exception 'Other worker reads private support';end if;checks:=checks+1;
  begin perform public.open_conversation('worker-support',worker_id);raise exception 'Other worker opens private support';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.open_conversation('move-team',job.id);raise exception 'Unassigned opens team';exception when insufficient_privilege then checks:=checks+1;end;
  if exists(select 1 from public.messages where conversation_id=conversation.id) then raise exception 'Unassigned reads team';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',other_id,'role','authenticated')::text,true);
  if exists(select 1 from public.conversations where id=any(array[support.id,worker_support.id,conversation.id])) then raise exception 'Unrelated conversation access';end if;checks:=checks+1;
  begin perform public.get_conversation_people(conversation.id);raise exception 'Unrelated names access';exception when insufficient_privilege then checks:=checks+1;end;
  -- Administrative fixture mutation only, fully rolled back.
  reset role;
  delete from public.job_workers where job_id=job.id;
  insert into public.job_workers(job_id,worker_id) values(job.id,unassigned_id);
  set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',worker_id,'role','authenticated')::text,true);
  if exists(select 1 from public.messages where conversation_id=conversation.id) then raise exception 'Removed worker history access';end if;checks:=checks+1;
  begin perform public.send_message(conversation.id,'Removed',gen_random_uuid());raise exception 'Removed send';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',unassigned_id,'role','authenticated')::text,true);
  if not exists(select 1 from public.messages where conversation_id=conversation.id) then raise exception 'New worker history';end if;checks:=checks+1;
  job:=public.advance_job(job.id,'scheduled',job.revision);
  perform public.send_message(conversation.id,'In progress',gen_random_uuid());checks:=checks+1;
  -- Phase 8G: completion needs a delivery photo.
  perform public.add_move_photo(job.request_id,job.id,'delivery','image/png',1000);
  job:=public.advance_job(job.id,'in-progress',job.revision);
  if not exists(select 1 from public.messages where conversation_id=conversation.id) then raise exception 'Final worker lost history';end if;checks:=checks+1;
  foreach customer_actor in array array[customer_actor,unassigned_id,admin_id,a2] loop
   perform set_config('request.jwt.claims',json_build_object('sub',customer_actor,'role','authenticated')::text,true);
   begin perform public.send_message(conversation.id,'After completion',gen_random_uuid());raise exception 'Completed chat writable';exception when sqlstate '22023' then checks:=checks+1;end;
  end loop;
  perform public.send_message(support.id,'Support stays open',gen_random_uuid());checks:=checks+1;
  begin perform public.open_conversation('move-team',gen_random_uuid());raise exception 'Missing job';exception when insufficient_privilege then checks:=checks+1;end;
  set local role anon;
  begin perform count(*) from public.messages;raise exception 'Anon read';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.open_conversation('customer-support',other_id);raise exception 'Anon open';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('test.messaging_checks',checks::text,true);
end $test$;
select current_setting('test.messaging_checks')::integer as assertions_passed;
select pass('messaging assertions completed');
select * from finish();
rollback;
