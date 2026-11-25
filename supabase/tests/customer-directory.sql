-- Administrator directory read checks; all temporary users roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  admin_id uuid:=gen_random_uuid(); customer_id uuid:=gen_random_uuid();
  empty_customer_id uuid:=gen_random_uuid(); worker_id uuid:=gen_random_uuid();
  changed integer; checks integer:=0;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid','{}'::jsonb
    from unnest(array[admin_id,customer_id,empty_customer_id,worker_id]) x(id);
  update public.profiles set role='admin' where id=admin_id;
  update public.profiles set role='worker' where id=worker_id;
  update public.profiles set full_name='Directory Test Customer',phone='202-555-0148' where id=customer_id;
  set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  if (select count(*) from public.profiles where role='customer' and id=any(array[customer_id,empty_customer_id,worker_id,admin_id]))<>2 then raise exception 'Customer role filter failed';end if;checks:=checks+1;
  if not exists(select 1 from public.profiles where id=empty_customer_id and role='customer') or exists(select 1 from public.move_requests r where r.customer_id=empty_customer_id) then raise exception 'No-request customer excluded';end if;checks:=checks+1;
  if not exists(select 1 from public.profiles where id=customer_id and full_name='Directory Test Customer' and phone='202-555-0148') then raise exception 'Saved contact fields unavailable';end if;checks:=checks+1;
  update public.profiles set phone='Forbidden' where id=customer_id;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Administrator changed customer contact details';end if;checks:=checks+1;
  begin update public.profiles set role='admin' where id=customer_id;raise exception 'Client role change allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',customer_id,'role','authenticated')::text,true);
  if (select count(*) from public.profiles where id=any(array[customer_id,empty_customer_id,worker_id,admin_id]))<>1 then raise exception 'Customer reads company directory';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',worker_id,'role','authenticated')::text,true);
  if exists(select 1 from public.profiles where role='customer' and id=any(array[customer_id,empty_customer_id])) then raise exception 'Worker reads customer directory';end if;checks:=checks+1;
  set local role anon;
  begin perform count(*) from public.profiles;raise exception 'Anonymous directory read allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('test.directory_checks',checks::text,true);
end $test$;
select current_setting('test.directory_checks')::integer as assertions_passed;
select pass('customer-directory assertions completed');
select * from finish();
rollback;
