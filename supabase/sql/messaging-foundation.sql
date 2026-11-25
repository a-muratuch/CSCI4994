begin;
create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('customer-support','worker-support','move-team')),
 owner_id uuid references public.profiles(id),
 job_id uuid references public.jobs(id),
 created_at timestamptz not null default now(),
 check((kind='move-team' and job_id is not null and owner_id is null) or (kind<>'move-team' and owner_id is not null and job_id is null)),
 unique(kind,owner_id), unique(job_id)
);
create index conversations_owner_idx on public.conversations(owner_id);
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id),
 sender_id uuid not null references public.profiles(id),
 body text not null check(char_length(body) between 1 and 2000 and body !~ '^[[:space:]]*$'),
 request_id uuid not null,
 created_at timestamptz not null default now(),
 unique(sender_id,request_id)
);
create index messages_conversation_history_idx on public.messages(conversation_id,created_at,id);
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations,public.messages from public,anon,authenticated;
grant select on public.conversations,public.messages to authenticated;

create function rebel_move_private.can_read_conversation(p_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.conversations c join public.profiles p on p.id=auth.uid()
 where c.id=p_id and (p.role='admin' or
 (c.kind='customer-support' and p.role='customer' and c.owner_id=p.id) or
 (c.kind='worker-support' and p.role='worker' and c.owner_id=p.id) or
 (c.kind='move-team' and rebel_move_private.can_read_job(c.job_id))));
$$;
revoke all on function rebel_move_private.can_read_conversation(uuid) from public,anon,authenticated;
grant execute on function rebel_move_private.can_read_conversation(uuid) to authenticated;
create policy "Read accessible conversations" on public.conversations for select to authenticated using(rebel_move_private.can_read_conversation(id));
create policy "Read accessible messages" on public.messages for select to authenticated using(rebel_move_private.can_read_conversation(conversation_id));

create function rebel_move_private.open_conversation(p_kind text,p_target_id uuid)
returns public.conversations language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); actor_role text; target_role text; result public.conversations%rowtype;
begin
 select role into actor_role from public.profiles where id=actor;
 if actor_role is null then raise exception 'Sign in to open messages.' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('customer-support','worker-support','move-team') or p_target_id is null then raise exception 'Invalid conversation.' using errcode='22023';end if;
 if p_kind='move-team' then
  perform 1 from public.jobs where id=p_target_id for update;
  if not found or not rebel_move_private.can_read_job(p_target_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
  insert into public.conversations(kind,job_id) values(p_kind,p_target_id) on conflict(job_id) do nothing;
  select * into result from public.conversations where job_id=p_target_id;
 else
  select role into target_role from public.profiles where id=p_target_id;
  if target_role is distinct from (case when p_kind='customer-support' then 'customer' else 'worker' end)
   or (actor_role<>'admin' and actor<>p_target_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
  insert into public.conversations(kind,owner_id) values(p_kind,p_target_id) on conflict(kind,owner_id) do nothing;
  select * into result from public.conversations where kind=p_kind and owner_id=p_target_id;
 end if;
 return result;
end;
$$;

create function rebel_move_private.send_message(p_conversation_id uuid,p_body text,p_request_id uuid)
returns public.messages language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); conversation public.conversations%rowtype; result public.messages%rowtype; job_status text; clean_body text;
begin
 if actor is null then raise exception 'Sign in to send messages.' using errcode='42501';end if;
 select * into conversation from public.conversations where id=p_conversation_id;
 if not found then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 -- Same job lock as scheduling and completion: authorization is checked after waiting.
 if conversation.kind='move-team' then
  select status into job_status from public.jobs where id=conversation.job_id for update;
 end if;
 if not rebel_move_private.can_read_conversation(p_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 if conversation.kind='move-team' and job_status not in ('scheduled','in-progress') then raise exception 'This conversation is closed because the move is completed.' using errcode='22023';end if;
 clean_body:=regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g');
 if clean_body is null or char_length(clean_body) not between 1 and 2000 or p_request_id is null then raise exception 'Enter a message of 1–2000 characters and a request ID.' using errcode='22023';end if;
 insert into public.messages(conversation_id,sender_id,body,request_id) values(p_conversation_id,actor,clean_body,p_request_id)
 on conflict(sender_id,request_id) do nothing returning * into result;
 if result.id is null then
  select * into result from public.messages where sender_id=actor and request_id=p_request_id;
  if result.conversation_id<>p_conversation_id or result.body<>clean_body then raise exception 'Request ID already used for a different message.' using errcode='22023';end if;
 end if;
 return result;
end;
$$;

create function rebel_move_private.get_conversation_people(p_conversation_id uuid)
returns table(person_id uuid,full_name text,role text) language plpgsql security definer set search_path=''
as $$
begin
 if not rebel_move_private.can_read_conversation(p_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 return query select p.id,p.full_name,p.role from public.profiles p
 where p.role='admin' or exists(select 1 from public.conversations c where c.id=p_conversation_id and
 (c.owner_id=p.id or exists(select 1 from public.jobs j join public.move_requests r on r.id=j.request_id where j.id=c.job_id and r.customer_id=p.id)
 or exists(select 1 from public.job_workers w where w.job_id=c.job_id and w.worker_id=p.id)))
 or exists(select 1 from public.messages m where m.conversation_id=p_conversation_id and m.sender_id=p.id)
 order by p.full_name,p.id;
end;
$$;
revoke all on function rebel_move_private.open_conversation(text,uuid),rebel_move_private.send_message(uuid,text,uuid),rebel_move_private.get_conversation_people(uuid) from public,anon,authenticated;
grant execute on function rebel_move_private.open_conversation(text,uuid),rebel_move_private.send_message(uuid,text,uuid),rebel_move_private.get_conversation_people(uuid) to authenticated;
create function public.open_conversation(p_kind text,p_target_id uuid) returns public.conversations language sql security invoker set search_path='' as $$select rebel_move_private.open_conversation(p_kind,p_target_id);$$;
create function public.send_message(p_conversation_id uuid,p_body text,p_request_id uuid) returns public.messages language sql security invoker set search_path='' as $$select rebel_move_private.send_message(p_conversation_id,p_body,p_request_id);$$;
create function public.get_conversation_people(p_conversation_id uuid) returns table(person_id uuid,full_name text,role text) language sql security invoker set search_path='' as $$select * from rebel_move_private.get_conversation_people(p_conversation_id);$$;
revoke all on function public.open_conversation(text,uuid),public.send_message(uuid,text,uuid),public.get_conversation_people(uuid) from public,anon,authenticated;
grant execute on function public.open_conversation(text,uuid),public.send_message(uuid,text,uuid),public.get_conversation_people(uuid) to authenticated;
commit;
