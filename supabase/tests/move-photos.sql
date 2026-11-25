-- Phase 7C move photo access rules for the table, functions and Storage.
-- Fictional temporary accounts only; every change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  wid uuid := gen_random_uuid();
  other_worker uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  tid uuid;
  req_id uuid := gen_random_uuid();
  other_req uuid := gen_random_uuid();
  est_id uuid := gen_random_uuid();
  jid uuid := gen_random_uuid();
  photo uuid;
  pickup uuid;
  n integer;
  checks integer := 0;
  as_user text := 'request.jwt.claims';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (other_id,other_id::text||'@example.invalid','{}'),
    (wid,wid::text||'@example.invalid','{}'),
    (other_worker,other_worker::text||'@example.invalid','{}'),
    (admin_id,admin_id::text||'@example.invalid','{}');
  update public.profiles set role='worker' where id in (wid,other_worker);
  update public.profiles set role='admin' where id=admin_id;
  insert into public.trucks(name) values ('Photo test truck') returning id into tid;
  insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details) values
    (req_id,owner_id,'1 Photo Lane','2 Photo Court',(now() at time zone 'America/Chicago')::date+7,'House','Studio','Photo fixture','None'),
    (other_req,other_id,'3 Photo Lane','4 Photo Court',(now() at time zone 'America/Chicago')::date+7,'House','Studio','Photo fixture','None');

  if not (select relrowsecurity from pg_class where oid='public.move_photos'::regclass) then raise exception 'RLS disabled'; end if;
  if (select public.photo_capabilities()) <> 9 then raise exception 'Capability missing'; end if;
  if (select public from storage.buckets where id='move-photos') is distinct from false then raise exception 'Bucket missing or public'; end if;
  if has_table_privilege('authenticated','public.move_photos','INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','public.move_photos','SELECT')
     or has_function_privilege('anon','public.add_move_photo(uuid,uuid,text,text,integer)','EXECUTE')
    then raise exception 'Unexpected grant'; end if;
  checks := checks + 4;

  set local role authenticated;
  -- Customer adds a request photo and may store its file once.
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  photo := public.add_move_photo(req_id,null,'request','image/jpeg',1000);
  insert into storage.objects(bucket_id,name) values ('move-photos',photo::text);
  if not exists (select 1 from storage.objects where bucket_id='move-photos' and name=photo::text) then raise exception 'Owner cannot read file'; end if;
  if not public.can_delete_move_photo(photo) then raise exception 'Owner cannot remove open photo'; end if;
  checks := checks + 3;
  begin insert into storage.objects(bucket_id,name) values ('move-photos',gen_random_uuid()::text); raise exception 'Unreserved file stored';
  exception when insufficient_privilege then checks := checks + 1; end;
  begin perform public.add_move_photo(req_id,null,'request','image/gif',1000); raise exception 'GIF accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.add_move_photo(req_id,null,'request','image/png',5242881); raise exception 'Oversized photo accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.add_move_photo(other_req,null,'request','image/png',1000); raise exception 'Photo added to another request';
  exception when sqlstate '42501' then checks := checks + 1; end;
  begin perform public.add_move_photo(req_id,null,'pickup','image/png',1000); raise exception 'Customer added condition photo';
  exception when sqlstate '42501' then checks := checks + 1; end;
  -- Up to ten request photos.
  for n in 2..10 loop perform public.add_move_photo(req_id,null,'request','image/png',1000); end loop;
  begin perform public.add_move_photo(req_id,null,'request','image/png',1000); raise exception 'Eleventh request photo accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;

  -- Another customer sees neither rows nor files and cannot store over them.
  perform set_config(as_user,json_build_object('sub',other_id,'role','authenticated')::text,true);
  if exists (select 1 from public.move_photos where request_id=req_id)
     or exists (select 1 from storage.objects where bucket_id='move-photos' and name=photo::text)
     or public.can_delete_move_photo(photo) then raise exception 'Other customer reaches photo'; end if;
  begin perform public.delete_move_photo(photo); raise exception 'Other customer removed photo';
  exception when sqlstate '42501' then checks := checks + 1; end;
  checks := checks + 1;

  -- Workers without an assignment see nothing.
  perform set_config(as_user,json_build_object('sub',wid,'role','authenticated')::text,true);
  if exists (select 1 from public.move_photos where request_id=req_id) then raise exception 'Unassigned worker reads photos'; end if;
  checks := checks + 1;

  -- Publishing an estimate closes request photos; then schedule and start a job.
  reset role;
  insert into public.estimates(id,request_id,status,terms,created_by) values (est_id,req_id,'draft','Photo terms',admin_id);
  insert into public.estimate_items(estimate_id,position,label,amount_cents) values (est_id,1,'Photo move',50000);
  update public.estimates set status='accepted',published_at=now(),decided_at=now(),total_cents=50000 where id=est_id;
  insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id)
    values (jid,req_id,est_id,(now() at time zone 'America/Chicago')::date+7,'08:00','12:00','08:00','09:00',tid);
  insert into public.job_workers(job_id,worker_id) values (jid,wid);
  set local role authenticated;

  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  if public.can_delete_move_photo(photo) then raise exception 'Closed request photo removable'; end if;
  begin perform public.delete_move_photo(photo); raise exception 'Closed request photo removed';
  exception when sqlstate '42501' then checks := checks + 1; end;
  checks := checks + 1;

  -- Assigned worker reads request photos but adds condition photos only in progress.
  perform set_config(as_user,json_build_object('sub',wid,'role','authenticated')::text,true);
  if (select count(*) from public.move_photos where request_id=req_id) <> 10 then raise exception 'Assigned worker cannot read request photos'; end if;
  checks := checks + 1;
  begin perform public.add_move_photo(req_id,jid,'pickup','image/png',1000); raise exception 'Scheduled job accepted photo';
  exception when sqlstate '22023' then checks := checks + 1; end;
  reset role;
  update public.jobs set status='in-progress' where id=jid;
  set local role authenticated;
  pickup := public.add_move_photo(req_id,jid,'pickup','image/webp',2000);
  if (select m.job_id from public.move_photos m where m.id=pickup) is distinct from jid then raise exception 'Condition photo not linked to job'; end if;
  if not public.can_delete_move_photo(pickup) then raise exception 'Worker cannot remove open condition photo'; end if;
  checks := checks + 2;
  begin perform public.add_move_photo(req_id,null,'request','image/png',1000); raise exception 'Worker added request photo';
  exception when sqlstate '42501' then checks := checks + 1; end;

  -- Other worker: not assigned, so no access or uploads.
  perform set_config(as_user,json_build_object('sub',other_worker,'role','authenticated')::text,true);
  if exists (select 1 from public.move_photos where id=pickup) then raise exception 'Other worker reads condition photo'; end if;
  begin perform public.add_move_photo(req_id,jid,'delivery','image/png',1000); raise exception 'Other worker added photo';
  exception when sqlstate '42501' then checks := checks + 1; end;
  checks := checks + 1;

  -- The customer sees the crew's condition photo but cannot remove it.
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  if not exists (select 1 from public.move_photos where id=pickup) or public.can_delete_move_photo(pickup)
    then raise exception 'Customer condition-photo access wrong'; end if;
  checks := checks + 1;

  -- Administrators read every photo.
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  if (select count(*) from public.move_photos where request_id=req_id) <> 11 then raise exception 'Admin cannot read photos'; end if;
  if not exists (select 1 from storage.objects where bucket_id='move-photos' and name=photo::text) then raise exception 'Admin cannot read file'; end if;
  checks := checks + 2;

  -- Removing the worker from the job removes access to its photos.
  reset role;
  delete from public.job_workers w where w.job_id=jid and w.worker_id=wid;
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',wid,'role','authenticated')::text,true);
  if exists (select 1 from public.move_photos where request_id=req_id) then raise exception 'Reassigned worker keeps access'; end if;
  checks := checks + 1;

  -- Completed jobs are read-only; inactive accounts lose access.
  reset role;
  insert into public.job_workers(job_id,worker_id) values (jid,wid);
  update public.jobs set status='completed' where id=jid;
  set local role authenticated;
  if public.can_delete_move_photo(pickup) then raise exception 'Completed job photo removable'; end if;
  begin perform public.add_move_photo(req_id,jid,'delivery','image/png',1000); raise exception 'Completed job accepted photo';
  exception when sqlstate '22023' then checks := checks + 1; end;
  checks := checks + 1;
  reset role;
  update public.profiles set active=false where id=owner_id;
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  if exists (select 1 from public.move_photos) then raise exception 'Inactive account reads photos'; end if;
  checks := checks + 1;

  -- Rate limit: 30 photos per account in ten minutes (fixture rows backfill the count).
  reset role;
  insert into public.move_photos(request_id,job_id,stage,uploaded_by,content_type,size_bytes)
    select req_id,jid,'pickup',other_id,'image/png',1000 from generate_series(1,30);
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',other_id,'role','authenticated')::text,true);
  begin perform public.add_move_photo(other_req,null,'request','image/png',1000); raise exception 'Rate limit ignored';
  exception when sqlstate 'P0001' then checks := checks + 1; end;

  reset role;
  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('move-photos assertions completed');
select * from finish();
rollback;
