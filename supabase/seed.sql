-- Disposable local accounts only. Never run this seed against a hosted project.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000'::uuid, id, 'authenticated', 'authenticated', email,
  extensions.crypt('Local-Test-Only-2026!', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', name), now(), now(), '', '', '', ''
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'customer@example.invalid', 'Local Customer'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'worker@example.invalid', 'Local Worker'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'admin@example.invalid', 'Local Administrator')
) accounts(id,email,name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now()
from auth.users where email in ('customer@example.invalid','worker@example.invalid','admin@example.invalid');

update public.profiles set role='worker' where id='10000000-0000-4000-8000-000000000002';
update public.profiles set role='admin' where id='10000000-0000-4000-8000-000000000003';
insert into public.trucks(id,name,capacity_cubic_feet) values ('20000000-0000-4000-8000-000000000001','Local Truck',800);
insert into public.worker_availability(worker_id,day,available,start_time,end_time)
select '10000000-0000-4000-8000-000000000002'::uuid, day, true, '08:00'::time, '17:00'::time
from generate_series(1,7) days(day);
