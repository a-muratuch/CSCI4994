-- Phase 8B standard estimate text: administrators only, same limits as estimates.
-- Fictional temporary accounts only; every change is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  admin_id uuid := gen_random_uuid();
  customer_id uuid := gen_random_uuid();
  worker_id uuid := gen_random_uuid();
  checks integer := 0;
  as_user text := 'request.jwt.claims';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (admin_id,admin_id::text||'@example.invalid','{}'),
    (customer_id,customer_id::text||'@example.invalid','{}'),
    (worker_id,worker_id::text||'@example.invalid','{}');
  update public.profiles set role='admin' where id=admin_id;
  update public.profiles set role='worker' where id=worker_id;

  if (select public.estimate_default_capabilities()) <> 10 then raise exception 'Capability missing'; end if;
  if (select cardinality(default_inclusions) from public.pricing_settings) < 1 then raise exception 'Defaults missing'; end if;
  if has_function_privilege('anon','public.save_estimate_defaults(text[],text[],text)','EXECUTE')
    then raise exception 'Anonymous execute allowed'; end if;
  checks := checks + 3;

  set local role authenticated;
  -- Administrators save trimmed text in order.
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform public.save_estimate_defaults(array[' Loading ','Truck'],array['Storage'],'  Standard terms  ');
  if (select default_inclusions from public.pricing_settings) <> array['Loading','Truck']
     or (select default_terms from public.pricing_settings) <> 'Standard terms'
    then raise exception 'Defaults not saved as trimmed text'; end if;
  checks := checks + 1;

  -- Limits match estimate validation.
  begin perform public.save_estimate_defaults('{}'::text[],array['Storage'],'Terms'); raise exception 'Empty list accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.save_estimate_defaults(array[repeat('x',501)],array['Storage'],'Terms'); raise exception 'Long item accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.save_estimate_defaults(array['  '],array['Storage'],'Terms'); raise exception 'Blank item accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.save_estimate_defaults(array_fill('Item'::text,array[21]),array['Storage'],'Terms'); raise exception 'Too many items accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.save_estimate_defaults(array['Loading'],array['Storage'],'   '); raise exception 'Blank terms accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.save_estimate_defaults(array['Loading'],array['Storage'],repeat('t',2001)); raise exception 'Long terms accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;

  -- Customers and workers can neither change nor read the settings.
  perform set_config(as_user,json_build_object('sub',customer_id,'role','authenticated')::text,true);
  begin perform public.save_estimate_defaults(array['Free piano'],array['None'],'Customer terms'); raise exception 'Customer changed defaults';
  exception when sqlstate '42501' then checks := checks + 1; end;
  if exists (select 1 from public.pricing_settings) then raise exception 'Customer reads pricing settings'; end if;
  checks := checks + 1;
  perform set_config(as_user,json_build_object('sub',worker_id,'role','authenticated')::text,true);
  begin perform public.save_estimate_defaults(array['Free piano'],array['None'],'Worker terms'); raise exception 'Worker changed defaults';
  exception when sqlstate '42501' then checks := checks + 1; end;

  -- Inactive administrators are refused.
  reset role;
  update public.profiles set active=false where id=admin_id;
  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  begin perform public.save_estimate_defaults(array['Loading'],array['Storage'],'Terms'); raise exception 'Inactive admin changed defaults';
  exception when sqlstate '42501' then checks := checks + 1; end;

  reset role;
  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('estimate-defaults assertions completed');
select * from finish();
rollback;
