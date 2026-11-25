-- Temporary users and profile changes are fully rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);
do $test$
declare
  owner_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid();
  rows_changed integer; checks integer:=0;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id::text||'@example.invalid','{}'),
    (other_id,other_id::text||'@example.invalid','{}');
  if not (select relrowsecurity from pg_class where oid='public.profiles'::regclass) then raise exception 'Profiles RLS disabled';end if;checks:=checks+1;
  set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,true);
  update public.profiles set full_name='Alex Jordan',phone='202-555-0148' where id=owner_id;
  get diagnostics rows_changed=row_count;
  if rows_changed<>1 or not exists(select 1 from public.profiles where id=owner_id and full_name='Alex Jordan' and phone='202-555-0148') then raise exception 'Own profile save failed';end if;checks:=checks+1;
  update public.profiles set full_name='Forbidden' where id=other_id;
  get diagnostics rows_changed=row_count;
  if rows_changed<>0 then raise exception 'Another profile changed';end if;checks:=checks+1;
  if exists(select 1 from public.profiles where id=other_id) then raise exception 'Other profile readable';end if;checks:=checks+1;
  begin update public.profiles set role='admin' where id=owner_id;raise exception 'Role update allowed';exception when insufficient_privilege then checks:=checks+1;end;
  begin update public.profiles set id=other_id where id=owner_id;raise exception 'Identity update allowed';exception when insufficient_privilege then checks:=checks+1;end;
  begin update public.profiles set full_name=repeat('x',101) where id=owner_id;raise exception 'Oversized name allowed';exception when check_violation then checks:=checks+1;end;
  begin update public.profiles set phone=repeat('1',31) where id=owner_id;raise exception 'Oversized phone allowed';exception when check_violation then checks:=checks+1;end;
  if not exists(select 1 from public.profiles where id=owner_id and role='customer' and full_name='Alex Jordan' and phone='202-555-0148') then raise exception 'Failed changes altered profile';end if;checks:=checks+1;
  set local role anon;
  begin update public.profiles set full_name='Forbidden' where id=owner_id;raise exception 'Anonymous profile update allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('test.profile_checks',checks::text,true);
end $test$;
select current_setting('test.profile_checks')::integer as assertions_passed;
select pass('customer-profile assertions completed');
select * from finish();
rollback;
