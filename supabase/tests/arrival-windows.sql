-- Phase 8D preferred arrival windows: owner-only, pending requests only.
-- Fictional temporary accounts only; every change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  req_id uuid := gen_random_uuid();
  est_id uuid := gen_random_uuid();
  checks integer := 0;
  as_user text := 'request.jwt.claims';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (other_id,other_id::text||'@example.invalid','{}'),
    (admin_id,admin_id::text||'@example.invalid','{}');
  update public.profiles set role='admin' where id=admin_id;
  insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details) values
    (req_id,owner_id,'1 Window Lane','2 Window Court',(now() at time zone 'America/Chicago')::date+9,'House','Studio','Boxes','None');

  if (select public.arrival_window_capabilities()) <> 12 then raise exception 'Capability missing'; end if;
  if has_function_privilege('anon','public.set_request_window(uuid,integer,text)','EXECUTE') then raise exception 'Anonymous execute allowed'; end if;
  checks := checks + 2;

  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  perform public.set_request_window(req_id,1,'midday');
  if (select preferred_window from public.move_requests where id=req_id) <> 'midday' then raise exception 'Window not saved'; end if;
  perform public.set_request_window(req_id,1,null);
  if (select preferred_window from public.move_requests where id=req_id) is not null then raise exception 'Window not cleared'; end if;
  checks := checks + 2;
  begin perform public.set_request_window(req_id,1,'evening'); raise exception 'Unknown window accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.set_request_window(req_id,7,'morning'); raise exception 'Stale revision accepted';
  exception when sqlstate '40001' then checks := checks + 1; end;

  -- Other customers and administrators cannot set a customer's preference.
  perform set_config(as_user,json_build_object('sub',other_id,'role','authenticated')::text,true);
  begin perform public.set_request_window(req_id,1,'morning'); raise exception 'Other customer changed window';
  exception when sqlstate '42501' then checks := checks + 1; end;
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  begin perform public.set_request_window(req_id,1,'morning'); raise exception 'Admin changed window';
  exception when sqlstate '42501' then checks := checks + 1; end;

  -- Publishing an estimate locks the preference.
  reset role;
  insert into public.estimates(id,request_id,status,terms,created_by) values (est_id,req_id,'draft','Terms',admin_id);
  insert into public.estimate_items(estimate_id,position,label,amount_cents) values (est_id,1,'Move',30000);
  update public.estimates set status='awaiting',published_at=now(),total_cents=30000 where id=est_id;
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  begin perform public.set_request_window(req_id,1,'afternoon'); raise exception 'Window changed after publication';
  exception when sqlstate '40001' then checks := checks + 1; end;

  -- A direct table update is not allowed.
  begin update public.move_requests set preferred_window='morning' where id=req_id;
    if found then raise exception 'Direct update allowed'; end if; checks := checks + 1;
  exception when insufficient_privilege then checks := checks + 1; end;

  reset role;
  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('arrival-windows assertions completed');
select * from finish();
rollback;
