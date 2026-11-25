-- Phase 8C: declining with a reason and the administrator notification.
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
  req2_id uuid := gen_random_uuid();
  est_id uuid := gen_random_uuid();
  est2_id uuid := gen_random_uuid();
  snapshot jsonb;
  checks integer := 0;
  as_user text := 'request.jwt.claims';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (other_id,other_id::text||'@example.invalid','{}'),
    (admin_id,admin_id::text||'@example.invalid','{}');
  update public.profiles set role='admin' where id=admin_id;
  insert into public.move_requests(id,customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details) values
    (req_id,owner_id,'1 Change Lane','2 Change Court',(now() at time zone 'America/Chicago')::date+9,'House','Studio','Boxes','None'),
    (req2_id,owner_id,'3 Change Lane','4 Change Court',(now() at time zone 'America/Chicago')::date+9,'House','Studio','Boxes','None');
  insert into public.estimates(id,request_id,status,terms,created_by) values
    (est_id,req_id,'draft','Change terms',admin_id),(est2_id,req2_id,'draft','Change terms',admin_id);
  insert into public.estimate_items(estimate_id,position,label,amount_cents) values (est_id,1,'Move',40000),(est2_id,1,'Move',40000);
  update public.estimates set status='awaiting',published_at=now(),total_cents=40000 where id in (est_id,est2_id);

  if (select public.estimate_change_capabilities()) <> 11 then raise exception 'Capability missing'; end if;
  if has_function_privilege('anon','public.decline_estimate(uuid,text,text)','EXECUTE') then raise exception 'Anonymous execute allowed'; end if;
  checks := checks + 2;

  set local role authenticated;
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  begin perform public.decline_estimate(est_id,'cheaper',null); raise exception 'Unknown reason accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.decline_estimate(est_id,'other','   '); raise exception 'Other without a note accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  begin perform public.decline_estimate(est_id,'price',repeat('x',501)); raise exception 'Long note accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;

  -- Another customer cannot decline this estimate.
  perform set_config(as_user,json_build_object('sub',other_id,'role','authenticated')::text,true);
  begin perform public.decline_estimate(est_id,'price',null); raise exception 'Other customer declined';
  exception when sqlstate '42501' then checks := checks + 1; end;
  -- Administrators cannot decline on the customer's behalf.
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  begin perform public.decline_estimate(est_id,'price',null); raise exception 'Admin declined';
  exception when sqlstate '42501' then checks := checks + 1; end;

  -- The owner asks for changes; the reason and trimmed note are saved once.
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  perform public.decline_estimate(est_id,'price','  Please quote two movers.  ');
  if (select row(status,decline_reason,decline_note)::text from public.estimates where id=est_id)
     <> '(declined,price,"Please quote two movers.")' then raise exception 'Decline not saved'; end if;
  checks := checks + 1;
  begin perform public.decline_estimate(est_id,'date',null); raise exception 'Second decision accepted';
  exception when sqlstate '22023' then checks := checks + 1; end;
  -- The customer is not notified about their own decision.
  if exists (select 1 from public.notifications where kind='estimate-declined') then raise exception 'Customer notified'; end if;
  checks := checks + 1;

  -- Administrators see the reason in their notification.
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  snapshot := public.notification_snapshot(false,1);
  if not exists (select 1 from jsonb_array_elements(snapshot->'items') i
      where i->>'kind'='estimate-declined' and i->>'target_id'=est_id::text and i->>'target_kind'='estimate'
        and i->>'title'='Customer requested estimate changes' and i->>'detail'='Reason: the price is too high')
    then raise exception 'Admin notification missing: %', snapshot; end if;
  checks := checks + 1;

  -- The older two-argument decline still works and still notifies.
  perform set_config(as_user,json_build_object('sub',owner_id,'role','authenticated')::text,true);
  perform public.decide_estimate(est2_id,'declined');
  perform set_config(as_user,json_build_object('sub',admin_id,'role','authenticated')::text,true);
  snapshot := public.notification_snapshot(false,1);
  if not exists (select 1 from jsonb_array_elements(snapshot->'items') i
      where i->>'target_id'=est2_id::text and i->>'title'='Customer declined an estimate'
        and i->>'detail'='Review the estimate and follow up')
    then raise exception 'Plain decline notification missing'; end if;
  checks := checks + 1;

  -- A reason belongs only to a declined estimate.
  reset role;
  begin update public.estimates set status='accepted' where id=est_id; raise exception 'Reason kept on accepted estimate';
  exception when check_violation then checks := checks + 1; end;

  perform set_config('request.tests.passed',checks::text,true);
end $test$;
select current_setting('request.tests.passed')::integer as assertions_passed;
select pass('estimate-change-requests assertions completed');
select * from finish();
rollback;
