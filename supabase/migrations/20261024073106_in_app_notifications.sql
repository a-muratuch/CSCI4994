-- Additive, prospective notifications. Hosted application requires separate owner approval.
begin;
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('estimate-published','job-scheduled','job-updated','message')),
 event_id uuid not null,
 estimate_id uuid references public.estimates(id),
 job_id uuid references public.jobs(id),
 message_id uuid references public.messages(id),
 conversation_id uuid references public.conversations(id),
 created_at timestamptz not null default clock_timestamp(),read_at timestamptz,
 unique(recipient_id,kind,event_id),
 check((kind='estimate-published' and estimate_id is not null and job_id is null and message_id is null and conversation_id is null)
 or (kind in ('job-scheduled','job-updated') and job_id is not null and estimate_id is null and message_id is null and conversation_id is null)
 or (kind='message' and message_id is not null and conversation_id is not null and estimate_id is null and job_id is null))
);
create index notifications_history on public.notifications(recipient_id,created_at desc,id desc);
create index notifications_unread on public.notifications(recipient_id,created_at desc,id desc) where read_at is null;
create index notifications_conversation on public.notifications(conversation_id,recipient_id) where kind='message';
create index notifications_estimate on public.notifications(estimate_id) where estimate_id is not null;
create index notifications_job on public.notifications(job_id) where job_id is not null;
create index notifications_message on public.notifications(message_id) where message_id is not null;
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;

create function rebel_move_private.can_read_notification(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select rebel_move_private.active_account() and exists(
  select 1 from public.notifications n where n.id=p_id and n.recipient_id=auth.uid() and case
   when n.kind='message' then rebel_move_private.can_read_conversation(n.conversation_id)
   when n.kind in ('job-scheduled','job-updated') then rebel_move_private.can_read_job(n.job_id)
   when n.kind='estimate-published' then exists(select 1 from public.estimates e join public.move_requests r on r.id=e.request_id
    join public.profiles p on p.id=auth.uid() where e.id=n.estimate_id and (p.role='admin' or (p.role='customer' and r.customer_id=p.id)))
   else false end
 );
$$;
revoke all on function rebel_move_private.can_read_notification(uuid) from public,anon,authenticated;
grant execute on function rebel_move_private.can_read_notification(uuid) to authenticated;
create policy own_accessible_notifications on public.notifications for select to authenticated
 using(recipient_id=(select auth.uid()) and rebel_move_private.can_read_notification(id));

-- Sources are committed operational events; retries that create no new event create no alert.
create function rebel_move_private.notify_estimate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.new_status='awaiting' then
  insert into public.notifications(recipient_id,kind,event_id,estimate_id)
  select r.customer_id,'estimate-published',new.id,e.id from public.estimates e
   join public.move_requests r on r.id=e.request_id join public.profiles p on p.id=r.customer_id
  where e.id=new.estimate_id and p.active and p.role='customer'
  on conflict(recipient_id,kind,event_id) do nothing;
 end if;return new;
end $$;
create function rebel_move_private.notify_job() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.action in ('scheduled','rescheduled') then
  insert into public.notifications(recipient_id,kind,event_id,job_id)
  select p.id,case when new.action='scheduled' then 'job-scheduled' else 'job-updated' end,new.id,new.job_id
  from public.profiles p where p.active and (
   (p.role='customer' and exists(select 1 from public.jobs j join public.move_requests r on r.id=j.request_id where j.id=new.job_id and r.customer_id=p.id))
   or (p.role='worker' and exists(select 1 from public.job_workers w where w.job_id=new.job_id and w.worker_id=p.id)))
  on conflict(recipient_id,kind,event_id) do nothing;
 end if;return new;
end $$;
create function rebel_move_private.notify_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.conversations%rowtype;
begin
 select * into c from public.conversations where id=new.conversation_id;
 insert into public.notifications(recipient_id,kind,event_id,message_id,conversation_id)
 select p.id,'message',new.id,new.id,c.id from public.profiles p where p.active and p.id<>new.sender_id and (
  p.role='admin' or
  (c.kind='customer-support' and p.role='customer' and c.owner_id=p.id) or
  (c.kind='worker-support' and p.role='worker' and c.owner_id=p.id) or
  (c.kind='move-team' and (
   (p.role='customer' and exists(select 1 from public.jobs j join public.move_requests r on r.id=j.request_id where j.id=c.job_id and r.customer_id=p.id)) or
   (p.role='worker' and exists(select 1 from public.job_workers w where w.job_id=c.job_id and w.worker_id=p.id)))))
 on conflict(recipient_id,kind,event_id) do nothing;
 return new;
end $$;
revoke all on function rebel_move_private.notify_estimate(),rebel_move_private.notify_job(),rebel_move_private.notify_message() from public,anon,authenticated;
create trigger notification_estimate after insert on public.estimate_events for each row execute function rebel_move_private.notify_estimate();
create trigger notification_job after insert on public.job_events for each row execute function rebel_move_private.notify_job();
create trigger notification_message after insert on public.messages for each row execute function rebel_move_private.notify_message();

create function public.notification_snapshot(p_unread boolean default false,p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;actor_role text;
begin
 if not rebel_move_private.active_account() then raise exception 'Active account required' using errcode='42501';end if;
 if p_unread is null or p_page is null or p_page not between 1 and 1000000 then raise exception 'Invalid notification filters' using errcode='22023';end if;
 select role into actor_role from public.profiles where id=auth.uid();
 with visible as (select * from public.notifications),
 page_rows as (select * from visible where not p_unread or read_at is null order by created_at desc,id desc limit 20 offset (p_page-1)*20),
 items as (select n.id,n.kind,n.created_at,n.read_at,
  case when n.kind='estimate-published' then 'estimate' when n.kind='message' then 'conversation' when actor_role='customer' then 'move' else 'job' end as target_kind,
  case when n.kind='estimate-published' then n.estimate_id when n.kind='message' then n.conversation_id when actor_role='customer' then j.request_id else n.job_id end as target_id,
  case when n.kind='estimate-published' then 'Estimate ready to review'
   when n.kind='job-scheduled' then 'Move scheduled'
   when n.kind='job-updated' then 'Appointment or team updated'
   when c.kind='move-team' then 'New team message'
   when c.kind='customer-support' and m.sender_id=c.owner_id then 'New customer message'
   when c.kind='worker-support' and m.sender_id=c.owner_id then 'New worker message'
   else 'New company message' end as title,
  case when n.kind='message' then case when c.kind='move-team' then 'Move-team conversation' else 'Company support' end
   when n.kind='estimate-published' then 'Acceptance does not confirm your moving date' else 'Review the latest appointment details' end as detail
  from page_rows n left join public.jobs j on j.id=n.job_id
  left join public.conversations c on c.id=n.conversation_id left join public.messages m on m.id=n.message_id)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id desc) from items i),'[]'::jsonb),
  'total',(select count(*) from visible where not p_unread or read_at is null),
  'unread',(select count(*) from visible where read_at is null),
  'through',(select id from visible order by created_at desc,id desc limit 1)) into result;
 return result;
end $$;
revoke all on function public.notification_snapshot(boolean,integer) from public,anon,authenticated;
grant execute on function public.notification_snapshot(boolean,integer) to authenticated;

create function rebel_move_private.mark_notifications(p_id uuid default null,p_through uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare cutoff public.notifications%rowtype;
begin
 perform rebel_move_private.require_active_account();
 if (p_id is null)=(p_through is null) then raise exception 'Choose one read action' using errcode='22023';end if;
 if not rebel_move_private.can_read_notification(coalesce(p_id,p_through)) then raise exception 'Notification unavailable' using errcode='42501';end if;
 if p_id is not null then
  update public.notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_id;
 else
  select * into cutoff from public.notifications where id=p_through;
  update public.notifications n set read_at=clock_timestamp() where n.recipient_id=auth.uid() and n.read_at is null
   and (n.created_at,n.id)<=(cutoff.created_at,cutoff.id) and rebel_move_private.can_read_notification(n.id);
 end if;
end $$;
revoke all on function rebel_move_private.mark_notifications(uuid,uuid) from public,anon,authenticated;
grant execute on function rebel_move_private.mark_notifications(uuid,uuid) to authenticated;
create function public.mark_notifications(p_id uuid default null,p_through uuid default null) returns void
language sql security invoker set search_path='' as $$select rebel_move_private.mark_notifications(p_id,p_through);$$;
revoke all on function public.mark_notifications(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_notifications(uuid,uuid) to authenticated;

-- Reading chat clears only alerts through the same stored message timestamp.
create function rebel_move_private.clear_message_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.notifications n set read_at=clock_timestamp() from public.messages m where n.kind='message'
  and n.message_id=m.id and n.recipient_id=new.user_id and n.conversation_id=new.conversation_id
  and n.read_at is null and m.created_at<=new.read_at;
 return new;
end $$;
revoke all on function rebel_move_private.clear_message_notifications() from public,anon,authenticated;
create trigger notification_chat_read after insert or update on public.conversation_reads for each row execute function rebel_move_private.clear_message_notifications();

-- Only the application table is published; Supabase's internal realtime schema is untouched.
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
  select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
  alter publication supabase_realtime add table public.notifications;
 end if;
end $$;
commit;
