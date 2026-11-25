-- Development-only ownership tests; all users and records are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  worker_id uuid := gen_random_uuid();
  record_id uuid;
  result_owner uuid;
  checks integer := 0;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (other_id,other_id::text||'@example.invalid','{}'),
    (worker_id,worker_id::text||'@example.invalid','{}');
  update public.profiles set role='worker' where id=worker_id;
  if not (select relrowsecurity from pg_class where oid='public.move_requests'::regclass) then raise exception 'RLS disabled'; end if;
  checks := checks+1;
  set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,true);
  insert into public.move_requests(pickup,destination,requested_date,property_type,move_size,items,access_details)
    values('12 Example Lane','25 Example Court',(now() at time zone 'America/Chicago')::date+7,'Apartment','Studio','Boxes','Ground floor') returning id,customer_id into record_id,result_owner;
  if result_owner<>owner_id then raise exception 'Owner default incorrect'; end if;
  checks := checks+1;
  if (select count(*) from public.move_requests where id=record_id)<>1 then raise exception 'Owner read failed'; end if;
  checks := checks+1;
  if has_column_privilege(current_user,'public.move_requests','customer_id','INSERT') then raise exception 'Client can choose owner'; end if;
  checks := checks+1;
  if has_table_privilege(current_user,'public.move_requests','UPDATE') or has_table_privilege(current_user,'public.move_requests','DELETE') then raise exception 'Unexpected direct mutation grant'; end if;
  checks := checks+1;
  begin
    insert into public.move_requests(pickup,destination,requested_date,property_type,move_size,items,access_details)
      values('Same address',' SAME ADDRESS ',(now() at time zone 'America/Chicago')::date+7,'Apartment','Studio','Boxes','Ground floor');
    raise exception 'Equal addresses allowed';
  exception when check_violation then checks:=checks+1; end;
  begin
    insert into public.move_requests(pickup,destination,requested_date,property_type,move_size,items,access_details)
      values('12 Example Lane','25 Example Court',(now() at time zone 'America/Chicago')::date-1,'Apartment','Studio','Boxes','Ground floor');
    raise exception 'Past date allowed';
  exception when insufficient_privilege then checks:=checks+1; end;
  perform set_config('request.jwt.claims',json_build_object('sub',other_id,'role','authenticated')::text,true);
  if exists(select 1 from public.move_requests where id=record_id) then raise exception 'Other customer can read'; end if;
  checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',worker_id,'role','authenticated')::text,true);
  if exists(select 1 from public.move_requests where id=record_id) then raise exception 'Unassigned worker can read'; end if;
  checks:=checks+1;
  begin
    insert into public.move_requests(pickup,destination,requested_date,property_type,move_size,items,access_details)
      values('12 Example Lane','25 Example Court',(now() at time zone 'America/Chicago')::date+7,'Apartment','Studio','Boxes','Ground floor');
    raise exception 'Worker can create';
  exception when insufficient_privilege then checks:=checks+1; end;
  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('customer-requests assertions completed');
select * from finish();
rollback;
