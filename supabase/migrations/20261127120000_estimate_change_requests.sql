-- Phase 8C: customers decline with a reason (or ask for changes) and
-- administrators are notified. Additive only; apply to the hosted project
-- only after owner approval. The two-argument decide_estimate keeps working.
begin;

alter table public.estimates
  add column decline_reason text check (decline_reason in ('price','date','scope','not-moving','other')),
  add column decline_note text check (char_length(decline_note) between 1 and 500),
  add constraint estimates_decline_reason_status check (decline_reason is null or status = 'declined');

-- Decline with a reason. Ownership, current version and "awaiting" status are
-- checked by decide_estimate; the reason is stored in the same transaction.
create function rebel_move_private.decline_estimate(p_estimate_id uuid, p_reason text, p_note text)
returns public.estimates language plpgsql security definer set search_path='' as $$
declare saved public.estimates%rowtype; note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_reason is null or p_reason not in ('price','date','scope','not-moving','other') then
    raise exception 'Choose a reason' using errcode = '22023'; end if;
  if char_length(note) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = '22023'; end if;
  if p_reason = 'other' and note is null then
    raise exception 'Describe what should change' using errcode = '22023'; end if;
  perform rebel_move_private.decide_estimate(p_estimate_id, 'declined');
  update public.estimates set decline_reason = p_reason, decline_note = note
    where id = p_estimate_id returning * into saved;
  return saved;
end $$;

create function public.decline_estimate(p_estimate_id uuid, p_reason text, p_note text) returns public.estimates
language sql security invoker set search_path='' as $$
  select rebel_move_private.decline_estimate(p_estimate_id, p_reason, p_note); $$;
create function public.estimate_change_capabilities() returns integer
language sql stable security invoker set search_path='' as $$ select 11; $$;

-- Administrators get an in-app notification when a customer declines.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications drop constraint notifications_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('estimate-published','estimate-declined','job-scheduled','job-updated','message'));
alter table public.notifications add constraint notifications_check check (
  (kind in ('estimate-published','estimate-declined') and estimate_id is not null and job_id is null and message_id is null and conversation_id is null)
  or (kind in ('job-scheduled','job-updated') and job_id is not null and estimate_id is null and message_id is null and conversation_id is null)
  or (kind = 'message' and message_id is not null and conversation_id is not null and estimate_id is null and job_id is null));

create or replace function rebel_move_private.can_read_notification(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select rebel_move_private.active_account() and exists(
  select 1 from public.notifications n where n.id=p_id and n.recipient_id=auth.uid() and case
   when n.kind='message' then rebel_move_private.can_read_conversation(n.conversation_id)
   when n.kind in ('job-scheduled','job-updated') then rebel_move_private.can_read_job(n.job_id)
   when n.kind='estimate-published' then exists(select 1 from public.estimates e join public.move_requests r on r.id=e.request_id
    join public.profiles p on p.id=auth.uid() where e.id=n.estimate_id and (p.role='admin' or (p.role='customer' and r.customer_id=p.id)))
   when n.kind='estimate-declined' then rebel_move_private.is_admin()
   else false end
 );
$$;

create or replace function rebel_move_private.notify_estimate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.new_status='awaiting' then
  insert into public.notifications(recipient_id,kind,event_id,estimate_id)
  select r.customer_id,'estimate-published',new.id,e.id from public.estimates e
   join public.move_requests r on r.id=e.request_id join public.profiles p on p.id=r.customer_id
  where e.id=new.estimate_id and p.active and p.role='customer'
  on conflict(recipient_id,kind,event_id) do nothing;
 elsif new.new_status='declined' then
  insert into public.notifications(recipient_id,kind,event_id,estimate_id)
  select p.id,'estimate-declined',new.id,new.estimate_id from public.profiles p
  where p.active and p.role='admin'
  on conflict(recipient_id,kind,event_id) do nothing;
 end if;return new;
end $$;

-- Same snapshot as before plus the declined-estimate title and reason.
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

revoke all on function rebel_move_private.decline_estimate(uuid,text,text), public.decline_estimate(uuid,text,text),
  public.estimate_change_capabilities() from public, anon, authenticated;
grant execute on function rebel_move_private.decline_estimate(uuid,text,text), public.decline_estimate(uuid,text,text),
  public.estimate_change_capabilities() to authenticated;

commit;
