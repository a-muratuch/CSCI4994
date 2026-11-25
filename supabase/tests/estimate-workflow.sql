-- Run against a development project through the SQL Editor or database tool.
-- All accounts and operational records are temporary and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  customer_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  worker_id uuid := gen_random_uuid();
  request_ids uuid[] := '{}';
  estimate_ids uuid[] := '{}';
  record_id uuid;
  i integer;
  checks text[] := '{}';
  result public.estimates%rowtype;
begin
  insert into auth.users(id, email, raw_user_meta_data)
  values
    (customer_id, customer_id::text || '@example.invalid', '{"role":"admin"}'),
    (other_id, other_id::text || '@example.invalid', '{}'),
    (admin_id, admin_id::text || '@example.invalid', '{}'),
    (worker_id, worker_id::text || '@example.invalid', '{}');
  if not ((select role from public.profiles where id=customer_id) = 'customer') then raise exception 'Failed: Signup metadata cannot grant admin'; end if;
checks := array_append(checks, 'Signup metadata cannot grant admin');
  update public.profiles set role='admin' where id=admin_id;
  update public.profiles set role='worker' where id=worker_id;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', customer_id, 'role', 'authenticated')::text, true);
  for i in 1..8 loop
    insert into public.move_requests(pickup,destination,requested_date,property_type,move_size,items,access_details)
    values ('12 Example Lane','25 Example Court',(now() at time zone 'America/Chicago')::date+7,
      'Apartment','1 bedroom','10 boxes','Ground floor')
    returning id into record_id;
    -- These are historical fixtures, not a burst of real customer submissions.
    reset role;
    update public.move_requests set created_at=now()-interval '1 day' where id=record_id;
    set local role authenticated;
    request_ids := array_append(request_ids,record_id);
  end loop;
  begin
insert into public.estimates(request_id,terms) values (request_ids[1],'Test terms');
raise exception 'Unexpected success: Customer cannot create estimate drafts';
exception when sqlstate '42501' then checks := array_append(checks, 'Customer cannot create estimate drafts');
end;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  for i in 1..8 loop
    insert into public.estimates(request_id,inclusions,exclusions,terms)
    values (request_ids[i],case when i=7 then array[''] else array['Labor'] end,
      case when i=6 then array[]::text[] else array['Packing supplies'] end,'Test terms; acceptance does not confirm a date.')
    returning id into record_id;
    estimate_ids := array_append(estimate_ids,record_id);
  end loop;
  if not ((select count(*) from public.estimates where id=any(estimate_ids))=8) then raise exception 'Failed: Administrator can read drafts'; end if;
checks := array_append(checks, 'Administrator can read drafts');
  for i in 1..3 loop
    insert into public.estimate_items(estimate_id,position,label,amount_cents)
    values (estimate_ids[i],1,'Labor',48000),(estimate_ids[i],2,'Transportation',17000);
  end loop;
  insert into public.estimate_items(estimate_id,position,label,amount_cents)
  values (estimate_ids[6],1,'Labor',100),(estimate_ids[7],1,'Labor',100),
    (estimate_ids[8],1,'Labor',999999999),(estimate_ids[8],2,'Transportation',1);
  -- Fourth estimate has no lines; fifth has only a zero-priced line.
  insert into public.estimate_items(estimate_id,position,label,amount_cents)
    values(estimate_ids[5],1,'Zero line',0);
  begin
perform public.publish_estimate(estimate_ids[4]);
raise exception 'Unexpected success: Empty pricing cannot publish';
exception when sqlstate '22023' then checks := array_append(checks, 'Empty pricing cannot publish');
end;
  begin
perform public.publish_estimate(estimate_ids[5]);
raise exception 'Unexpected success: Zero total cannot publish';
exception when sqlstate '22023' then checks := array_append(checks, 'Zero total cannot publish');
end;

  begin
    perform public.publish_estimate(estimate_ids[6]);
    raise exception 'Unexpected success: Missing scope';
  exception when sqlstate '22023' then checks := array_append(checks,'Missing scope cannot publish'); end;
  begin
    perform public.publish_estimate(estimate_ids[7]);
    raise exception 'Unexpected success: Blank scope';
  exception when sqlstate '22023' then checks := array_append(checks,'Blank scope cannot publish'); end;
  begin
    perform public.publish_estimate(estimate_ids[8]);
    raise exception 'Unexpected success: Excessive total';
  exception when sqlstate '22023' then checks := array_append(checks,'Excessive total cannot publish'); end;
  begin
    perform public.publish_estimate(gen_random_uuid());
    raise exception 'Unexpected success: Missing estimate';
  exception when sqlstate '22023' then checks := array_append(checks,'Missing estimate cannot publish'); end;

  perform set_config('request.jwt.claims', json_build_object('sub', customer_id, 'role', 'authenticated')::text, true);
  if not ((select count(*) from public.estimates where id=any(estimate_ids))=0) then raise exception 'Failed: Customer cannot read draft estimates'; end if;
checks := array_append(checks, 'Customer cannot read draft estimates');
  if not ((select count(*) from public.estimate_items where estimate_id=any(estimate_ids))=0) then raise exception 'Failed: Customer cannot read draft pricing'; end if;
checks := array_append(checks, 'Customer cannot read draft pricing');
  begin
perform public.publish_estimate(estimate_ids[1]);
raise exception 'Unexpected success: Customer cannot publish';
exception when sqlstate '42501' then checks := array_append(checks, 'Customer cannot publish');
end;
  begin
perform public.decide_estimate(estimate_ids[1],'accepted');
raise exception 'Unexpected success: Customer cannot decide draft';
exception when sqlstate '22023' then checks := array_append(checks, 'Customer cannot decide draft');
end;
  begin
update public.estimates set status='accepted' where id=estimate_ids[1];
raise exception 'Unexpected success: Direct status updates are denied';
exception when sqlstate '42501' then checks := array_append(checks, 'Direct status updates are denied');
end;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select * into result from public.publish_estimate(estimate_ids[1]);
  if not (result.status='awaiting' and result.published_at is not null) then raise exception 'Failed: Publication sets awaiting and timestamp'; end if;
checks := array_append(checks, 'Publication sets awaiting and timestamp');
  if not (result.total_cents=65000) then raise exception 'Failed: Publication snapshots integer total'; end if;
checks := array_append(checks, 'Publication snapshots integer total');
  begin
perform public.publish_estimate(estimate_ids[1]);
raise exception 'Unexpected success: Repeat publication is denied';
exception when sqlstate '22023' then checks := array_append(checks, 'Repeat publication is denied');
end;
  begin
insert into public.estimate_items(estimate_id,position,label,amount_cents) values(estimate_ids[1],3,'Extra',100);
raise exception 'Unexpected success: Published pricing insertion is denied';
exception when sqlstate '22023' then checks := array_append(checks, 'Published pricing insertion is denied');
end;
  perform public.publish_estimate(estimate_ids[2]);
  perform public.publish_estimate(estimate_ids[3]);
  begin
perform public.decide_estimate(estimate_ids[1],'accepted');
raise exception 'Unexpected success: Administrator cannot accept for customer';
exception when sqlstate '42501' then checks := array_append(checks, 'Administrator cannot accept for customer');
end;

  perform set_config('request.jwt.claims', json_build_object('sub', other_id, 'role', 'authenticated')::text, true);
  if not ((select count(*) from public.estimates where id=any(estimate_ids))=0) then raise exception 'Failed: Other customer cannot read published estimates'; end if;
checks := array_append(checks, 'Other customer cannot read published estimates');
  if not ((select count(*) from public.estimate_items where estimate_id=any(estimate_ids))=0) then raise exception 'Failed: Other customer cannot read pricing'; end if;
checks := array_append(checks, 'Other customer cannot read pricing');
  if not ((select count(*) from public.estimate_events where estimate_id=any(estimate_ids))=0) then raise exception 'Failed: Other customer cannot read events'; end if;
checks := array_append(checks, 'Other customer cannot read events');
  begin
perform public.decide_estimate(estimate_ids[1],'accepted');
raise exception 'Unexpected success: Other customer cannot decide';
exception when sqlstate '42501' then checks := array_append(checks, 'Other customer cannot decide');
end;
  perform set_config('request.jwt.claims', json_build_object('sub', worker_id, 'role', 'authenticated')::text, true);
  if not ((select count(*) from public.estimates where id=any(estimate_ids))=0) then raise exception 'Failed: Worker cannot read estimates'; end if;
checks := array_append(checks, 'Worker cannot read estimates');
  begin
perform public.publish_estimate(estimate_ids[4]);
raise exception 'Unexpected success: Worker cannot publish';
exception when sqlstate '42501' then checks := array_append(checks, 'Worker cannot publish');
end;
  begin
perform public.decide_estimate(estimate_ids[1],'accepted');
raise exception 'Unexpected success: Worker cannot decide';
exception when sqlstate '42501' then checks := array_append(checks, 'Worker cannot decide');
end;

  perform set_config('request.jwt.claims', json_build_object('sub', customer_id, 'role', 'authenticated')::text, true);
  if not ((select count(*) from public.estimates where id=any(estimate_ids))=3) then raise exception 'Failed: Owning customer sees published estimates'; end if;
checks := array_append(checks, 'Owning customer sees published estimates');
  if not ((select count(*) from public.estimate_items where estimate_id=any(estimate_ids))=6) then raise exception 'Failed: Owning customer sees published pricing'; end if;
checks := array_append(checks, 'Owning customer sees published pricing');
  begin
perform public.decide_estimate(estimate_ids[1],'scheduled');
raise exception 'Unexpected success: Invalid decision is denied';
exception when sqlstate '22023' then checks := array_append(checks, 'Invalid decision is denied');
end;
  begin
perform public.decide_estimate(estimate_ids[1],null);
raise exception 'Unexpected success: Null decision is denied';
exception when sqlstate '22023' then checks := array_append(checks, 'Null decision is denied');
end;
  select * into result from public.decide_estimate(estimate_ids[1],'accepted');
  if not (result.status='accepted' and result.decided_at is not null and result.published_at is not null and result.total_cents=65000) then raise exception 'Failed: Acceptance records decision and preserves publication'; end if;
checks := array_append(checks, 'Acceptance records decision and preserves publication');
  begin
perform public.decide_estimate(estimate_ids[1],'accepted');
raise exception 'Unexpected success: Repeated acceptance is denied';
exception when sqlstate '22023' then checks := array_append(checks, 'Repeated acceptance is denied');
end;
  begin
perform public.decide_estimate(estimate_ids[1],'declined');
raise exception 'Unexpected success: Acceptance cannot be reversed';
exception when sqlstate '22023' then checks := array_append(checks, 'Acceptance cannot be reversed');
end;
  select * into result from public.decide_estimate(estimate_ids[2],'declined');
  if not (result.status='declined' and result.decided_at is not null) then raise exception 'Failed: Decline records decision'; end if;
checks := array_append(checks, 'Decline records decision');
  begin
perform public.decide_estimate(estimate_ids[2],'accepted');
raise exception 'Unexpected success: Decline cannot be reversed';
exception when sqlstate '22023' then checks := array_append(checks, 'Decline cannot be reversed');
end;
  if not ((select count(*) from public.estimate_events where estimate_id=any(estimate_ids))=5) then raise exception 'Failed: Successful actions have exactly one event each'; end if;
checks := array_append(checks, 'Successful actions have exactly one event each');
  if not ((select count(*) from public.estimate_events where estimate_id=any(estimate_ids) and actor_id=admin_id)=3 and (select count(*) from public.estimate_events where estimate_id=any(estimate_ids) and actor_id=customer_id)=2) then raise exception 'Failed: Publication and decision actors recorded'; end if;
checks := array_append(checks, 'Publication and decision actors recorded');
  begin
insert into public.estimate_events(estimate_id,actor_id,previous_status,new_status) values(estimate_ids[1],customer_id,'awaiting','accepted');
raise exception 'Unexpected success: Customers cannot forge audit events';
exception when sqlstate '42501' then checks := array_append(checks, 'Customers cannot forge audit events');
end;
  begin
perform public.decide_estimate(gen_random_uuid(),'accepted');
raise exception 'Unexpected success: Missing estimates cannot be decided';
exception when sqlstate '42501' then checks := array_append(checks, 'Missing estimates cannot be decided');
end;

  set local role anon;
  begin
perform public.publish_estimate(estimate_ids[1]);
raise exception 'Unexpected success: Anonymous publication execution is denied';
exception when sqlstate '42501' then checks := array_append(checks, 'Anonymous publication execution is denied');
end;
  begin
perform public.decide_estimate(estimate_ids[1],'accepted');
raise exception 'Unexpected success: Anonymous decision execution is denied';
exception when sqlstate '42501' then checks := array_append(checks, 'Anonymous decision execution is denied');
end;
  begin
perform count(*) from public.estimates;
raise exception 'Unexpected success: Anonymous estimate reads are denied';
exception when sqlstate '42501' then checks := array_append(checks, 'Anonymous estimate reads are denied');
end;
  reset role;
  perform set_config('test.estimate_checks',array_to_json(checks)::text,true);
end;
$test$;
select json_build_object('passed',json_array_length(current_setting('test.estimate_checks')::json),
  'checks',current_setting('test.estimate_checks')::json) as test_result;
select pass('estimate-workflow assertions completed');
select * from finish();
rollback;
