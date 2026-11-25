-- Isolated directory visibility checks; no records survive rollback.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
 a uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); w2 uuid:=gen_random_uuid(); checks integer:=0;
begin
 insert into auth.users(id,email,raw_user_meta_data) select id,id::text||'@example.invalid','{}'::jsonb from unnest(array[a,c,w,w2]) x(id);
 update public.profiles set role='admin' where id=a;
 update public.profiles set role='worker',full_name='Directory Worker' where id=any(array[w,w2]);
 insert into public.worker_availability(worker_id,day,available,start_time,end_time) values(w,1,true,'08:00','17:00');
 set local role authenticated;
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 if (select count(*) from public.profiles where role='worker' and id=any(array[a,c,w,w2]))<>2 then raise exception 'Worker filter failed';end if; checks:=checks+1;
 if not exists(select 1 from public.profiles where id=w2 and role='worker') or exists(select 1 from public.worker_availability where worker_id=w2) then raise exception 'Unconfigured worker excluded';end if;checks:=checks+1;
 if not exists(select 1 from public.worker_availability where worker_id=w and day=1 and available) then raise exception 'Admin availability read failed';end if;checks:=checks+1;
 begin update public.worker_availability set available=false where worker_id=w;raise exception 'Direct availability editing allowed';exception when insufficient_privilege then checks:=checks+1;end;
 perform set_config('request.jwt.claims',json_build_object('sub',w2,'role','authenticated')::text,true);
 if exists(select 1 from public.worker_availability where worker_id=w) then raise exception 'Coworker availability exposed';end if;checks:=checks+1;
 if exists(select 1 from public.profiles where id=w) then raise exception 'Coworker profile exposed';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',json_build_object('sub',c,'role','authenticated')::text,true);
 if exists(select 1 from public.profiles where id=any(array[w,w2])) or exists(select 1 from public.worker_availability where worker_id=w) then raise exception 'Customer staff directory access';end if;checks:=checks+1;
 set local role anon;
 begin perform count(*) from public.worker_availability;raise exception 'Anonymous availability access';exception when insufficient_privilege then checks:=checks+1;end;
 perform set_config('test.worker_directory_checks',checks::text,true);
end $test$;
select current_setting('test.worker_directory_checks')::integer as assertions_passed;
select pass('worker-directory assertions completed');
select * from finish();
rollback;
