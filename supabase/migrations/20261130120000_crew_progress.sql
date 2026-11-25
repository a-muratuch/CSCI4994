-- Phase 8G: "On the way" and "Arrived" steps, a delivery photo before
-- completion (administrators may waive it) and customer/admin notifications.
-- Additive for data; apply to the hosted project only after owner approval.
-- Job statuses are unchanged: "Arrived" is the existing start of the job.
begin;

alter table public.jobs
  add column on_the_way_at timestamptz,
  add column photo_waived_at timestamptz,
  add column photo_waived_by uuid references public.profiles(id),
  add column photo_waiver_note text check (char_length(photo_waiver_note) between 1 and 200),
  add constraint jobs_photo_waiver_complete check ((photo_waived_at is null) = (photo_waived_by is null));

alter table public.job_events drop constraint job_events_action_check;
alter table public.job_events add constraint job_events_action_check check (action in
  ('scheduled','rescheduled','on-the-way','in-progress','completed','cancelled','photo-waived'));

-- Worker: tell the customer the crew is on the way (scheduled date only).
create function rebel_move_private.mark_on_the_way(p_job_id uuid, p_expected_revision integer) returns public.jobs
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); job public.jobs%rowtype;
begin
  perform rebel_move_private.require_active_account();
  if actor is null or not exists (select 1 from public.profiles where id = actor and role = 'worker') then
    raise exception 'Only assigned workers can update progress.' using errcode = '42501'; end if;
  select * into job from public.jobs where id = p_job_id for update;
  if not found or not exists (select 1 from public.job_workers where job_id = p_job_id and worker_id = actor) then
    raise exception 'This job is not assigned to this worker.' using errcode = '42501'; end if;
  if p_expected_revision is distinct from job.revision then
    raise exception 'The job changed. Reload before updating progress.' using errcode = '40001'; end if;
  if job.status <> 'scheduled' or job.on_the_way_at is not null
     or job.scheduled_date <> (now() at time zone 'America/Chicago')::date then
    raise exception 'Mark on the way on the moving day, before arriving.' using errcode = '22023'; end if;
  update public.jobs set on_the_way_at = now(), revision = revision + 1, updated_at = now()
    where id = p_job_id returning * into job;
  insert into public.job_events(job_id, actor_id, action, details)
    values (p_job_id, actor, 'on-the-way', jsonb_build_object('revision', job.revision));
  return job;
end $$;

-- Arrived (start) and completed. Completion needs a delivery photo unless an
-- administrator waived it. Cancelled and completed jobs cannot advance.
create or replace function rebel_move_private.advance_job(p_job_id uuid, p_expected_status text, p_expected_revision integer)
returns public.jobs language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); job_record public.jobs%rowtype; next_status text;
begin
  perform rebel_move_private.require_active_account();
  if actor is null or not exists (select 1 from public.profiles where id = actor and role = 'worker') then
    raise exception 'Only assigned workers can update progress.' using errcode = '42501'; end if;
  select * into job_record from public.jobs where id = p_job_id for update;
  if not found or not exists (select 1 from public.job_workers where job_id = p_job_id and worker_id = actor) then
    raise exception 'This job is not assigned to this worker.' using errcode = '42501'; end if;
  if p_expected_status is distinct from job_record.status or p_expected_revision is distinct from job_record.revision then
    raise exception 'The job changed. Reload before updating progress.' using errcode = '40001'; end if;
  if job_record.status not in ('scheduled', 'in-progress') then
    raise exception 'Completed and cancelled jobs are read-only.' using errcode = '22023'; end if;
  next_status := case when job_record.status = 'scheduled' then 'in-progress' else 'completed' end;
  if next_status = 'completed' and job_record.photo_waived_at is null
     and not exists (select 1 from public.move_photos where job_id = p_job_id and stage = 'delivery') then
    raise exception 'Add at least one delivery photo before completing.' using errcode = '22023', hint = 'delivery_photo'; end if;
  update public.jobs set status = next_status, revision = revision + 1, updated_at = now()
    where id = p_job_id returning * into job_record;
  insert into public.job_events(job_id, actor_id, action, details)
    values (p_job_id, actor, next_status, jsonb_build_object('previous_status', p_expected_status, 'revision', job_record.revision));
  return job_record;
end $$;

-- Administrator: allow completion without a delivery photo (for example a
-- broken phone). Recorded with an optional note and kept in the history.
create function rebel_move_private.waive_delivery_photo(p_job_id uuid, p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare job public.jobs%rowtype; note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform rebel_move_private.require_active_account();
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if char_length(note) > 200 then raise exception 'Keep the note under 200 characters' using errcode = '22023'; end if;
  select * into job from public.jobs where id = p_job_id for update;
  if not found or job.status not in ('scheduled', 'in-progress') or job.photo_waived_at is not null then
    raise exception 'Only an open job without a waiver can be waived' using errcode = '22023'; end if;
  update public.jobs set photo_waived_at = now(), photo_waived_by = auth.uid(), photo_waiver_note = note,
    revision = revision + 1, updated_at = now() where id = p_job_id returning * into job;
  insert into public.job_events(job_id, actor_id, action, details)
    values (p_job_id, auth.uid(), 'photo-waived', jsonb_build_object('revision', job.revision));
end $$;

-- Notifications: crew on the way and arrived (customer), delivery photos
-- (customer and administrators, once per job).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications drop constraint notifications_check;
alter table public.notifications add constraint notifications_kind_check check (kind in
  ('estimate-published','estimate-declined','job-scheduled','job-updated','crew-on-the-way','crew-arrived','delivery-photos','message'));
alter table public.notifications add constraint notifications_check check (
  (kind in ('estimate-published','estimate-declined') and estimate_id is not null and job_id is null and message_id is null and conversation_id is null)
  or (kind in ('job-scheduled','job-updated','crew-on-the-way','crew-arrived','delivery-photos') and job_id is not null and estimate_id is null and message_id is null and conversation_id is null)
  or (kind = 'message' and message_id is not null and conversation_id is not null and estimate_id is null and job_id is null));

create or replace function rebel_move_private.can_read_notification(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select rebel_move_private.active_account() and exists(
  select 1 from public.notifications n where n.id=p_id and n.recipient_id=auth.uid() and case
   when n.kind='message' then rebel_move_private.can_read_conversation(n.conversation_id)
   when n.kind in ('job-scheduled','job-updated','crew-on-the-way','crew-arrived','delivery-photos') then rebel_move_private.can_read_job(n.job_id)
   when n.kind='estimate-published' then exists(select 1 from public.estimates e join public.move_requests r on r.id=e.request_id
    join public.profiles p on p.id=auth.uid() where e.id=n.estimate_id and (p.role='admin' or (p.role='customer' and r.customer_id=p.id)))
   when n.kind='estimate-declined' then rebel_move_private.is_admin()
   else false end
 );
$$;

create or replace function rebel_move_private.notify_job() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.action in ('scheduled','rescheduled') then
  insert into public.notifications(recipient_id,kind,event_id,job_id)
  select p.id,case when new.action='scheduled' then 'job-scheduled' else 'job-updated' end,new.id,new.job_id
  from public.profiles p where p.active and (
   (p.role='customer' and exists(select 1 from public.jobs j join public.move_requests r on r.id=j.request_id where j.id=new.job_id and r.customer_id=p.id))
   or (p.role='worker' and exists(select 1 from public.job_workers w where w.job_id=new.job_id and w.worker_id=p.id)))
  on conflict(recipient_id,kind,event_id) do nothing;
 elsif new.action in ('on-the-way','in-progress') then
  insert into public.notifications(recipient_id,kind,event_id,job_id)
  select p.id,case when new.action='on-the-way' then 'crew-on-the-way' else 'crew-arrived' end,new.id,new.job_id
  from public.jobs j join public.move_requests r on r.id=j.request_id join public.profiles p on p.id=r.customer_id
  where j.id=new.job_id and p.active and p.role='customer'
  on conflict(recipient_id,kind,event_id) do nothing;
 end if;return new;
end $$;

-- The first delivery photo of a job notifies the customer and administrators.
create function rebel_move_private.notify_delivery_photo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.stage='delivery' and new.job_id is not null then
  insert into public.notifications(recipient_id,kind,event_id,job_id)
  select p.id,'delivery-photos',new.job_id,new.job_id from public.profiles p
  where p.active and (p.role='admin' or (p.role='customer' and exists(
    select 1 from public.move_requests r where r.id=new.request_id and r.customer_id=p.id)))
  on conflict(recipient_id,kind,event_id) do nothing;
 end if;return new;
end $$;
revoke all on function rebel_move_private.notify_delivery_photo() from public,anon,authenticated;
create trigger notification_delivery_photo after insert on public.move_photos
  for each row execute function rebel_move_private.notify_delivery_photo();

-- Same snapshot as Phase 8C plus the three crew-progress titles.
create or replace function public.notification_snapshot(p_unread boolean default false,p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;actor_role text;
begin
 if not rebel_move_private.active_account() then raise exception 'Active account required' using errcode='42501';end if;
 if p_unread is null or p_page is null or p_page not between 1 and 1000000 then raise exception 'Invalid notification filters' using errcode='22023';end if;
 select role into actor_role from public.profiles where id=auth.uid();
 with visible as (select * from public.notifications),
 page_rows as (select * from visible where not p_unread or read_at is null order by created_at desc,id desc limit 20 offset (p_page-1)*20),
 items as (select n.id,n.kind,n.created_at,n.read_at,
  case when n.kind in ('estimate-published','estimate-declined') then 'estimate' when n.kind='message' then 'conversation' when actor_role='customer' then 'move' else 'job' end as target_kind,
  case when n.kind in ('estimate-published','estimate-declined') then n.estimate_id when n.kind='message' then n.conversation_id when actor_role='customer' then j.request_id else n.job_id end as target_id,
  case when n.kind='estimate-published' then 'Estimate ready to review'
   when n.kind='estimate-declined' then case when e.decline_reason is null or e.decline_reason='not-moving'
     then 'Customer declined an estimate' else 'Customer requested estimate changes' end
   when n.kind='job-scheduled' then 'Move scheduled'
   when n.kind='job-updated' then 'Appointment or team updated'
   when n.kind='crew-on-the-way' then 'Your crew is on the way'
   when n.kind='crew-arrived' then 'Your crew has arrived'
   when n.kind='delivery-photos' then 'Delivery photos added'
   when c.kind='move-team' then 'New team message'
   when c.kind='customer-support' and m.sender_id=c.owner_id then 'New customer message'
   when c.kind='worker-support' and m.sender_id=c.owner_id then 'New worker message'
   else 'New company message' end as title,
  case when n.kind='message' then case when c.kind='move-team' then 'Move-team conversation' else 'Company support' end
   when n.kind='estimate-published' then 'Acceptance does not confirm your moving date'
   when n.kind='estimate-declined' then case e.decline_reason
     when 'price' then 'Reason: the price is too high'
     when 'date' then 'Reason: the date or timing does not work'
     when 'scope' then 'Reason: items or services need changes'
     when 'not-moving' then 'Reason: no longer moving'
     when 'other' then 'Reason: other (see the note)'
     else 'Review the estimate and follow up' end
   when n.kind in ('crew-on-the-way','crew-arrived') then 'Follow progress on your move page'
   when n.kind='delivery-photos' then 'Review the delivery condition photos'
   else 'Review the latest appointment details' end as detail
  from page_rows n left join public.jobs j on j.id=n.job_id
  left join public.estimates e on e.id=n.estimate_id
  left join public.conversations c on c.id=n.conversation_id left join public.messages m on m.id=n.message_id)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id desc) from items i),'[]'::jsonb),
  'total',(select count(*) from visible where not p_unread or read_at is null),
  'unread',(select count(*) from visible where read_at is null),
  'through',(select id from visible order by created_at desc,id desc limit 1)) into result;
 return result;
end $$;

create function public.mark_on_the_way(p_job_id uuid, p_expected_revision integer) returns public.jobs
language sql security invoker set search_path='' as $$ select rebel_move_private.mark_on_the_way(p_job_id, p_expected_revision); $$;
create function public.waive_delivery_photo(p_job_id uuid, p_note text) returns void
language sql security invoker set search_path='' as $$ select rebel_move_private.waive_delivery_photo(p_job_id, p_note); $$;
create function public.crew_progress_capabilities() returns integer
language sql stable security invoker set search_path='' as $$ select 14; $$;

revoke all on function rebel_move_private.mark_on_the_way(uuid,integer), rebel_move_private.waive_delivery_photo(uuid,text),
  public.mark_on_the_way(uuid,integer), public.waive_delivery_photo(uuid,text), public.crew_progress_capabilities()
  from public, anon, authenticated;
grant execute on function rebel_move_private.mark_on_the_way(uuid,integer), rebel_move_private.waive_delivery_photo(uuid,text),
  public.mark_on_the_way(uuid,integer), public.waive_delivery_photo(uuid,text), public.crew_progress_capabilities()
  to authenticated;

commit;
