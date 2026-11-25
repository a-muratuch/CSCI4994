-- Local baseline captured from approved read-only catalog inspection on 2026-10-14.

-- Contains schema/security definitions only; no hosted accounts, messages or operation records.

-- Apply only to a fresh local Supabase stack; never push this snapshot onto the existing hosted project.

set check_function_bodies = false;

create schema if not exists rebel_move_private;

revoke all on schema rebel_move_private from public;

grant usage on schema rebel_move_private to authenticated;

create table "public"."conversations" (
  "id" uuid default gen_random_uuid() not null,
  "kind" text not null,
  "owner_id" uuid,
  "job_id" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."estimate_events" (
  "id" uuid default gen_random_uuid() not null,
  "estimate_id" uuid not null,
  "actor_id" uuid not null,
  "previous_status" text not null,
  "new_status" text not null,
  "occurred_at" timestamp with time zone default now() not null
);

create table "public"."estimate_items" (
  "id" uuid default gen_random_uuid() not null,
  "estimate_id" uuid not null,
  "position" integer not null,
  "label" text not null,
  "amount_cents" integer not null
);

create table "public"."estimates" (
  "id" uuid default gen_random_uuid() not null,
  "request_id" uuid not null,
  "status" text default 'draft'::text not null,
  "inclusions" text[] default '{}'::text[] not null,
  "exclusions" text[] default '{}'::text[] not null,
  "terms" text not null,
  "created_by" uuid default auth.uid() not null,
  "created_at" timestamp with time zone default now() not null,
  "published_at" timestamp with time zone,
  "decided_at" timestamp with time zone,
  "total_cents" bigint,
  "revision" integer default 1 not null
);

create table "public"."job_events" (
  "id" uuid default gen_random_uuid() not null,
  "job_id" uuid not null,
  "actor_id" uuid not null,
  "action" text not null,
  "details" jsonb not null,
  "occurred_at" timestamp with time zone default now() not null
);

create table "public"."job_workers" (
  "job_id" uuid not null,
  "worker_id" uuid not null
);

create table "public"."jobs" (
  "id" uuid default gen_random_uuid() not null,
  "request_id" uuid not null,
  "estimate_id" uuid not null,
  "scheduled_date" date not null,
  "start_time" time without time zone not null,
  "end_time" time without time zone not null,
  "arrival_start" time without time zone not null,
  "arrival_end" time without time zone not null,
  "truck_id" uuid not null,
  "status" text default 'scheduled'::text not null,
  "revision" integer default 1 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."messages" (
  "id" uuid default gen_random_uuid() not null,
  "conversation_id" uuid not null,
  "sender_id" uuid not null,
  "body" text not null,
  "request_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."move_requests" (
  "id" uuid default gen_random_uuid() not null,
  "customer_id" uuid default auth.uid() not null,
  "pickup" text not null,
  "destination" text not null,
  "requested_date" date not null,
  "property_type" text not null,
  "move_size" text not null,
  "items" text not null,
  "access_details" text not null,
  "notes" text default ''::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."profiles" (
  "id" uuid not null,
  "full_name" text default ''::text not null,
  "phone" text default ''::text not null,
  "role" text default 'customer'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."trucks" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."worker_availability" (
  "worker_id" uuid not null,
  "day" integer not null,
  "available" boolean not null,
  "start_time" time without time zone not null,
  "end_time" time without time zone not null
);

alter table "public"."conversations" add constraint "conversations_check" CHECK ((((kind = 'move-team'::text) AND (job_id IS NOT NULL) AND (owner_id IS NULL)) OR ((kind <> 'move-team'::text) AND (owner_id IS NOT NULL) AND (job_id IS NULL))));

alter table "public"."conversations" add constraint "conversations_kind_check" CHECK ((kind = ANY (ARRAY['customer-support'::text, 'worker-support'::text, 'move-team'::text])));

alter table "public"."move_requests" add constraint "different_addresses" CHECK ((lower(TRIM(BOTH FROM pickup)) <> lower(TRIM(BOTH FROM destination))));

alter table "public"."estimate_events" add constraint "estimate_events_new_status_check" CHECK ((new_status = ANY (ARRAY['awaiting'::text, 'accepted'::text, 'declined'::text])));

alter table "public"."estimate_events" add constraint "estimate_events_previous_status_check" CHECK ((previous_status = ANY (ARRAY['draft'::text, 'awaiting'::text])));

alter table "public"."estimate_items" add constraint "estimate_items_amount_cents_check" CHECK (((amount_cents >= 0) AND (amount_cents <= 999999999)));

alter table "public"."estimate_items" add constraint "estimate_items_label_check" CHECK (((char_length(TRIM(BOTH FROM label)) >= 1) AND (char_length(TRIM(BOTH FROM label)) <= 2000)));

alter table "public"."estimate_items" add constraint "estimate_items_position_check" CHECK ((("position" >= 1) AND ("position" <= 20)));

alter table "public"."estimates" add constraint "estimates_revision_check" CHECK ((revision > 0));

alter table "public"."estimates" add constraint "estimates_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'awaiting'::text, 'accepted'::text, 'declined'::text])));

alter table "public"."estimates" add constraint "estimates_terms_check" CHECK (((char_length(TRIM(BOTH FROM terms)) >= 1) AND (char_length(TRIM(BOTH FROM terms)) <= 2000)));

alter table "public"."estimates" add constraint "estimates_total_cents_check" CHECK (((total_cents IS NULL) OR ((total_cents >= 1) AND (total_cents <= 999999999))));

alter table "public"."profiles" add constraint "full_name_length" CHECK ((char_length(full_name) <= 100));

alter table "public"."job_events" add constraint "job_events_action_check" CHECK ((action = ANY (ARRAY['scheduled'::text, 'rescheduled'::text, 'in-progress'::text, 'completed'::text])));

alter table "public"."jobs" add constraint "jobs_check" CHECK (((start_time < end_time) AND (end_time < '24:00:00'::time without time zone)));

alter table "public"."jobs" add constraint "jobs_check1" CHECK (((arrival_start >= start_time) AND (arrival_start < arrival_end) AND (arrival_end <= end_time)));

alter table "public"."jobs" add constraint "jobs_check2" CHECK (((EXTRACT(second FROM start_time) = (0)::numeric) AND (EXTRACT(second FROM end_time) = (0)::numeric) AND (EXTRACT(second FROM arrival_start) = (0)::numeric) AND (EXTRACT(second FROM arrival_end) = (0)::numeric)));

alter table "public"."jobs" add constraint "jobs_finite_date" CHECK (isfinite(scheduled_date));

alter table "public"."jobs" add constraint "jobs_revision_check" CHECK ((revision > 0));

alter table "public"."jobs" add constraint "jobs_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'in-progress'::text, 'completed'::text])));

alter table "public"."messages" add constraint "messages_body_check" CHECK ((((char_length(body) >= 1) AND (char_length(body) <= 2000)) AND (body !~ '^[[:space:]]*$'::text)));

alter table "public"."move_requests" add constraint "move_requests_access_details_check" CHECK (((char_length(TRIM(BOTH FROM access_details)) >= 1) AND (char_length(TRIM(BOTH FROM access_details)) <= 2000)));

alter table "public"."move_requests" add constraint "move_requests_destination_check" CHECK (((char_length(TRIM(BOTH FROM destination)) >= 1) AND (char_length(TRIM(BOTH FROM destination)) <= 2000)));

alter table "public"."move_requests" add constraint "move_requests_items_check" CHECK (((char_length(TRIM(BOTH FROM items)) >= 1) AND (char_length(TRIM(BOTH FROM items)) <= 2000)));

alter table "public"."move_requests" add constraint "move_requests_move_size_check" CHECK (((char_length(TRIM(BOTH FROM move_size)) >= 1) AND (char_length(TRIM(BOTH FROM move_size)) <= 2000)));

alter table "public"."move_requests" add constraint "move_requests_notes_check" CHECK ((char_length(notes) <= 2000));

alter table "public"."move_requests" add constraint "move_requests_pickup_check" CHECK (((char_length(TRIM(BOTH FROM pickup)) >= 1) AND (char_length(TRIM(BOTH FROM pickup)) <= 2000)));

alter table "public"."move_requests" add constraint "move_requests_property_type_check" CHECK (((char_length(TRIM(BOTH FROM property_type)) >= 1) AND (char_length(TRIM(BOTH FROM property_type)) <= 2000)));

alter table "public"."profiles" add constraint "phone_length" CHECK ((char_length(phone) <= 30));

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['customer'::text, 'worker'::text, 'admin'::text])));

alter table "public"."trucks" add constraint "trucks_name_check" CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 100)));

alter table "public"."worker_availability" add constraint "worker_availability_check" CHECK (((start_time < '24:00:00'::time without time zone) AND (end_time < '24:00:00'::time without time zone)));

alter table "public"."worker_availability" add constraint "worker_availability_check1" CHECK (((EXTRACT(second FROM start_time) = (0)::numeric) AND (EXTRACT(second FROM end_time) = (0)::numeric)));

alter table "public"."worker_availability" add constraint "worker_availability_check2" CHECK (((NOT available) OR (end_time > start_time)));

alter table "public"."worker_availability" add constraint "worker_availability_day_check" CHECK (((day >= 1) AND (day <= 7)));

alter table "public"."conversations" add constraint "conversations_pkey" PRIMARY KEY (id);

alter table "public"."estimate_events" add constraint "estimate_events_pkey" PRIMARY KEY (id);

alter table "public"."estimate_items" add constraint "estimate_items_pkey" PRIMARY KEY (id);

alter table "public"."estimates" add constraint "estimates_pkey" PRIMARY KEY (id);

alter table "public"."job_events" add constraint "job_events_pkey" PRIMARY KEY (id);

alter table "public"."job_workers" add constraint "job_workers_pkey" PRIMARY KEY (job_id, worker_id);

alter table "public"."jobs" add constraint "jobs_pkey" PRIMARY KEY (id);

alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY (id);

alter table "public"."move_requests" add constraint "move_requests_pkey" PRIMARY KEY (id);

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table "public"."trucks" add constraint "trucks_pkey" PRIMARY KEY (id);

alter table "public"."worker_availability" add constraint "worker_availability_pkey" PRIMARY KEY (worker_id, day);

alter table "public"."conversations" add constraint "conversations_job_id_key" UNIQUE (job_id);

alter table "public"."conversations" add constraint "conversations_kind_owner_id_key" UNIQUE (kind, owner_id);

alter table "public"."estimate_items" add constraint "estimate_items_estimate_id_position_key" UNIQUE (estimate_id, "position");

alter table "public"."estimates" add constraint "estimates_id_request_unique" UNIQUE (id, request_id);

alter table "public"."estimates" add constraint "estimates_request_id_key" UNIQUE (request_id);

alter table "public"."jobs" add constraint "jobs_estimate_id_key" UNIQUE (estimate_id);

alter table "public"."jobs" add constraint "jobs_request_id_key" UNIQUE (request_id);

alter table "public"."messages" add constraint "messages_sender_id_request_id_key" UNIQUE (sender_id, request_id);

alter table "public"."conversations" add constraint "conversations_job_id_fkey" FOREIGN KEY (job_id) REFERENCES jobs(id);

alter table "public"."conversations" add constraint "conversations_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES profiles(id);

alter table "public"."estimate_events" add constraint "estimate_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id);

alter table "public"."estimate_events" add constraint "estimate_events_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id);

alter table "public"."estimate_items" add constraint "estimate_items_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE;

alter table "public"."estimates" add constraint "estimates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);

alter table "public"."estimates" add constraint "estimates_request_id_fkey" FOREIGN KEY (request_id) REFERENCES move_requests(id);

alter table "public"."job_events" add constraint "job_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES profiles(id);

alter table "public"."job_events" add constraint "job_events_job_id_fkey" FOREIGN KEY (job_id) REFERENCES jobs(id);

alter table "public"."job_workers" add constraint "job_workers_job_id_fkey" FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

alter table "public"."job_workers" add constraint "job_workers_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES profiles(id);

alter table "public"."jobs" add constraint "jobs_estimate_id_request_id_fkey" FOREIGN KEY (estimate_id, request_id) REFERENCES estimates(id, request_id);

alter table "public"."jobs" add constraint "jobs_request_id_fkey" FOREIGN KEY (request_id) REFERENCES move_requests(id);

alter table "public"."jobs" add constraint "jobs_truck_id_fkey" FOREIGN KEY (truck_id) REFERENCES trucks(id);

alter table "public"."messages" add constraint "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id);

alter table "public"."messages" add constraint "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id);

alter table "public"."move_requests" add constraint "move_requests_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES profiles(id);

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."worker_availability" add constraint "worker_availability_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES profiles(id);

CREATE OR REPLACE FUNCTION public.advance_job(p_job_id uuid, p_expected_status text, p_expected_revision integer)
 RETURNS jobs
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select rebel_move_private.advance_job(p_job_id,p_expected_status,p_expected_revision); $function$;

CREATE OR REPLACE FUNCTION public.create_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100),
    'customer'
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decide_estimate(p_estimate_id uuid, p_decision text)
 RETURNS estimates
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select rebel_move_private.decide_estimate(p_estimate_id, p_decision); $function$;

CREATE OR REPLACE FUNCTION public.get_conversation_people(p_conversation_id uuid)
 RETURNS TABLE(person_id uuid, full_name text, role text)
 LANGUAGE sql
 SET search_path TO ''
AS $function$select * from rebel_move_private.get_conversation_people(p_conversation_id);$function$;

CREATE OR REPLACE FUNCTION public.get_job_team(p_job_id uuid)
 RETURNS TABLE(worker_id uuid, full_name text)
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select * from rebel_move_private.get_job_team(p_job_id); $function$;

CREATE OR REPLACE FUNCTION public.open_conversation(p_kind text, p_target_id uuid)
 RETURNS conversations
 LANGUAGE sql
 SET search_path TO ''
AS $function$select rebel_move_private.open_conversation(p_kind,p_target_id);$function$;

CREATE OR REPLACE FUNCTION public.publish_estimate(p_estimate_id uuid)
 RETURNS estimates
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select rebel_move_private.publish_estimate(p_estimate_id); $function$;

CREATE OR REPLACE FUNCTION public.publish_reviewed_estimate(p_estimate_id uuid, p_revision integer)
 RETURNS estimates
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select rebel_move_private.publish_reviewed_estimate(p_estimate_id,p_revision);
$function$;

CREATE OR REPLACE FUNCTION public.save_estimate_draft(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb)
 RETURNS estimates
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select rebel_move_private.save_estimate_draft(p_request_id,p_estimate_id,p_revision,p_input);
$function$;

CREATE OR REPLACE FUNCTION public.save_job(p_estimate_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_arrival_start time without time zone, p_arrival_end time without time zone, p_worker_ids uuid[], p_truck_id uuid, p_job_id uuid DEFAULT NULL::uuid, p_expected_revision integer DEFAULT NULL::integer)
 RETURNS jobs
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select rebel_move_private.save_job(p_estimate_id,p_date,p_start,p_end,p_arrival_start,p_arrival_end,
  p_worker_ids,p_truck_id,p_job_id,p_expected_revision); $function$;

CREATE OR REPLACE FUNCTION public.save_worker_availability(p_days jsonb)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select rebel_move_private.save_worker_availability(p_days); $function$;

CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id uuid, p_body text, p_request_id uuid)
 RETURNS messages
 LANGUAGE sql
 SET search_path TO ''
AS $function$select rebel_move_private.send_message(p_conversation_id,p_body,p_request_id);$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.advance_job(p_job_id uuid, p_expected_status text, p_expected_revision integer)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); job_record public.jobs%rowtype; next_status text;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='worker') then
    raise exception 'Only assigned workers can update progress.' using errcode='42501'; end if;
  select * into job_record from public.jobs where id=p_job_id for update;
  if not found or not exists(select 1 from public.job_workers where job_id=p_job_id and worker_id=actor) then
    raise exception 'This job is not assigned to this worker.' using errcode='42501'; end if;
  if p_expected_status is distinct from job_record.status
    or p_expected_revision is distinct from job_record.revision then
    raise exception 'The job changed. Reload before updating progress.' using errcode='40001'; end if;
  if job_record.status='completed' then raise exception 'Completed jobs are read-only.' using errcode='22023'; end if;
  next_status:=case when job_record.status='scheduled' then 'in-progress' else 'completed' end;
  update public.jobs set status=next_status,revision=revision+1,updated_at=now()
    where id=p_job_id returning * into job_record;
  insert into public.job_events(job_id,actor_id,action,details)
    values(p_job_id,actor,next_status,jsonb_build_object('previous_status',p_expected_status,'revision',job_record.revision));
  return job_record;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.can_read_conversation(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.conversations c join public.profiles p on p.id=auth.uid()
 where c.id=p_id and (p.role='admin' or
 (c.kind='customer-support' and p.role='customer' and c.owner_id=p.id) or
 (c.kind='worker-support' and p.role='worker' and c.owner_id=p.id) or
 (c.kind='move-team' and rebel_move_private.can_read_job(c.job_id))));
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.can_read_job(p_job_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1 from public.jobs j
    join public.move_requests r on r.id=j.request_id
    join public.profiles p on p.id=auth.uid()
    where j.id=p_job_id and (
      p.role='admin'
      or (p.role='customer' and r.customer_id=p.id)
      or (p.role='worker' and exists(
        select 1 from public.job_workers w where w.job_id=j.id and w.worker_id=p.id
      ))
    )
  );
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.decide_estimate(p_estimate_id uuid, p_decision text)
 RETURNS estimates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  estimate_record public.estimates%rowtype;
begin
  if actor is null or not exists (
    select 1 from public.profiles where id = actor and role = 'customer'
  ) then
    raise exception 'Only the owning customer can decide an estimate.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('accepted', 'declined') then
    raise exception 'Choose accepted or declined.' using errcode = '22023';
  end if;
  select * into estimate_record from public.estimates
    where id = p_estimate_id for update;
  if not found or not exists (
    select 1 from public.move_requests
    where id = estimate_record.request_id and customer_id = actor
  ) then
    raise exception 'This estimate is not available to this customer.' using errcode = '42501';
  end if;
  if estimate_record.status <> 'awaiting' then
    raise exception 'Only an estimate awaiting a decision can be accepted or declined.'
      using errcode = '22023';
  end if;
  update public.estimates set status = p_decision, decided_at = now()
    where id = p_estimate_id returning * into estimate_record;
  insert into public.estimate_events(estimate_id, actor_id, previous_status, new_status)
    values (p_estimate_id, actor, 'awaiting', p_decision);
  return estimate_record;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.get_conversation_people(p_conversation_id uuid)
 RETURNS TABLE(person_id uuid, full_name text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not rebel_move_private.can_read_conversation(p_conversation_id) then raise exception 'Conversation unavailable.' using errcode='42501';end if;
 return query select p.id,p.full_name,p.role from public.profiles p
 where p.role='admin' or exists(select 1 from public.conversations c where c.id=p_conversation_id and
 (c.owner_id=p.id or exists(select 1 from public.jobs j join public.move_requests r on r.id=j.request_id where j.id=c.job_id and r.customer_id=p.id)
 or exists(select 1 from public.job_workers w where w.job_id=c.job_id and w.worker_id=p.id)))
 or exists(select 1 from public.messages m where m.conversation_id=p_conversation_id and m.sender_id=p.id)
 order by p.full_name,p.id;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.get_job_team(p_job_id uuid)
 RETURNS TABLE(worker_id uuid, full_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not rebel_move_private.can_read_job(p_job_id) then
    raise exception 'This job is not available to this user.' using errcode='42501';
  end if;
  return query select p.id,p.full_name
    from public.job_workers w join public.profiles p on p.id=w.worker_id
    where w.job_id=p_job_id order by p.full_name,p.id;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.guard_pricing_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare current_status text;
begin
  select status into current_status from public.estimates where id=new.estimate_id for update;
  if not found or current_status<>'draft' then raise exception 'Pricing can only be added to a draft estimate.' using errcode='22023'; end if;
  update public.estimates set revision=revision+1 where id=new.estimate_id;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION rebel_move_private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $function$;

CREATE OR REPLACE FUNCTION rebel_move_private.open_conversation(p_kind text, p_target_id uuid)
 RETURNS conversations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.publish_estimate(p_estimate_id uuid)
 RETURNS estimates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  estimate_record public.estimates%rowtype;
  line_count bigint;
  price bigint;
begin
  if actor is null or not exists (
    select 1 from public.profiles where id = actor and role = 'admin'
  ) then
    raise exception 'Only administrators can publish estimates.' using errcode = '42501';
  end if;
  select * into estimate_record from public.estimates
    where id = p_estimate_id for update;
  if not found or estimate_record.status <> 'draft' then
    raise exception 'A draft estimate is required.' using errcode = '22023';
  end if;
  select count(*), coalesce(sum(amount_cents), 0) into line_count, price
    from public.estimate_items where estimate_id = p_estimate_id;
  if line_count not between 1 and 20 or price not between 1 and 999999999 then
    raise exception 'Provide 1–20 pricing lines and a positive total up to $9,999,999.99.'
      using errcode = '22023';
  end if;
  if cardinality(estimate_record.inclusions) not between 1 and 20
    or cardinality(estimate_record.exclusions) not between 1 and 20
    or exists (
      select 1 from unnest(estimate_record.inclusions || estimate_record.exclusions) as item(value)
      where value is null or char_length(trim(value)) not between 1 and 500
    ) then
    raise exception 'Provide valid inclusions and exclusions; write None if applicable.'
      using errcode = '22023';
  end if;
  update public.estimates set status = 'awaiting', published_at = now(), total_cents = price
    where id = p_estimate_id returning * into estimate_record;
  insert into public.estimate_events(estimate_id, actor_id, previous_status, new_status)
    values (p_estimate_id, actor, 'draft', 'awaiting');
  return estimate_record;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.publish_reviewed_estimate(p_estimate_id uuid, p_revision integer)
 RETURNS estimates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare saved public.estimates%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Administrator required' using errcode='42501'; end if;
  select * into saved from public.estimates where id=p_estimate_id for update;
  if not found or saved.revision is distinct from p_revision or saved.status <> 'draft' then raise exception 'Draft changed or published; review again' using errcode='40001'; end if;
  return rebel_move_private.publish_estimate(p_estimate_id);
end $function$;

CREATE OR REPLACE FUNCTION rebel_move_private.save_estimate_draft(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb)
 RETURNS estimates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  saved public.estimates%rowtype;
  line jsonb;
  included text[];
  excluded text[];
  price bigint := 0;
  position integer := 0;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if jsonb_typeof(p_input) is distinct from 'object'
    or jsonb_typeof(p_input->'lines') is distinct from 'array'
    or jsonb_typeof(p_input->'inclusions') is distinct from 'array'
    or jsonb_typeof(p_input->'exclusions') is distinct from 'array'
    or jsonb_typeof(p_input->'terms') is distinct from 'string' then
    raise exception 'Invalid draft' using errcode='22023';
  end if;
  if jsonb_array_length(p_input->'lines') not between 1 and 20
    or jsonb_array_length(p_input->'inclusions') not between 1 and 20
    or jsonb_array_length(p_input->'exclusions') not between 1 and 20
    or char_length(trim(p_input->>'terms')) not between 1 and 2000 then
    raise exception 'Invalid scope or terms' using errcode='22023';
  end if;
  for line in select value from jsonb_array_elements(p_input->'lines') loop
    if jsonb_typeof(line) is distinct from 'object'
      or jsonb_typeof(line->'label') is distinct from 'string'
      or char_length(trim(line->>'label')) not between 1 and 150
      or jsonb_typeof(line->'amountCents') is distinct from 'number'
      or not ((line->>'amountCents') ~ '^[0-9]{1,9}$') then
      raise exception 'Invalid pricing line' using errcode='22023';
    end if;
    price := price + (line->>'amountCents')::bigint;
  end loop;
  if price not between 1 and 999999999 then raise exception 'Invalid total' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements((p_input->'inclusions')||(p_input->'exclusions')) x
    where jsonb_typeof(x) is distinct from 'string' or char_length(trim(x #>> '{}')) not between 1 and 500) then
    raise exception 'Invalid scope item' using errcode='22023';
  end if;
  select array_agg(trim(value)) into included from jsonb_array_elements_text(p_input->'inclusions');
  select array_agg(trim(value)) into excluded from jsonb_array_elements_text(p_input->'exclusions');
  -- The parent lock serializes duplicate creation; the estimate lock matches publication.
  perform 1 from public.move_requests where id=p_request_id for update;
  if not found then raise exception 'Request unavailable' using errcode='22023'; end if;
  select * into saved from public.estimates where request_id=p_request_id for update;
  if found then
    if p_estimate_id is distinct from saved.id or p_revision is distinct from saved.revision or saved.status <> 'draft' then
      raise exception 'Draft changed or published; reopen it' using errcode='40001';
    end if;
    update public.estimates set inclusions=included, exclusions=excluded, terms=trim(p_input->>'terms'), revision=revision+1
      where id=saved.id returning * into saved;
    delete from public.estimate_items where estimate_id=saved.id;
  else
    if p_estimate_id is not null or p_revision is distinct from 0 then raise exception 'Draft unavailable' using errcode='40001'; end if;
    insert into public.estimates(request_id,created_by,inclusions,exclusions,terms)
      values(p_request_id,actor,included,excluded,trim(p_input->>'terms')) returning * into saved;
  end if;
  for line in select value from jsonb_array_elements(p_input->'lines') loop
    position := position+1;
    insert into public.estimate_items(estimate_id,position,label,amount_cents)
      values(saved.id,position,trim(line->>'label'),(line->>'amountCents')::integer);
  end loop;
  select * into saved from public.estimates where id=saved.id;
  return saved;
end $function$;

CREATE OR REPLACE FUNCTION rebel_move_private.save_job(p_estimate_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_arrival_start time without time zone, p_arrival_end time without time zone, p_worker_ids uuid[], p_truck_id uuid, p_job_id uuid DEFAULT NULL::uuid, p_expected_revision integer DEFAULT NULL::integer)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid:=auth.uid();
  estimate_record public.estimates%rowtype;
  job_record public.jobs%rowtype;
  target_id uuid:=coalesce(p_job_id,gen_random_uuid());
  event_action text;
begin
  if actor is null or not rebel_move_private.is_admin() then
    raise exception 'Only administrators can schedule and assign jobs.' using errcode='42501';
  end if;
  if p_date is null or not isfinite(p_date) or p_start is null or p_end is null or p_arrival_start is null
    or p_arrival_end is null or p_start>=p_end or p_end>=time '24:00'
    or p_arrival_start<p_start or p_arrival_start>=p_arrival_end or p_arrival_end>p_end
    or extract(second from p_start)<>0 or extract(second from p_end)<>0
    or extract(second from p_arrival_start)<>0 or extract(second from p_arrival_end)<>0 then
    raise exception 'Provide a same-day work interval with an arrival window inside it.' using errcode='22023';
  end if;
  if p_worker_ids is null or cardinality(p_worker_ids)<1
    or array_ndims(p_worker_ids)<>1
    or exists(select 1 from unnest(p_worker_ids) as x(id) where id is null)
    or (select count(distinct id) from unnest(p_worker_ids) as x(id))<>cardinality(p_worker_ids) then
    raise exception 'Choose at least one worker without duplicates.' using errcode='22023';
  end if;
  if p_job_id is null then
    if p_expected_revision is not null then raise exception 'New jobs have no prior revision.' using errcode='22023'; end if;
    select * into estimate_record from public.estimates where id=p_estimate_id for update;
    if not found or estimate_record.status<>'accepted' then
      raise exception 'An accepted estimate is required.' using errcode='22023'; end if;
    if exists(select 1 from public.jobs where estimate_id=p_estimate_id or request_id=estimate_record.request_id) then
      raise exception 'This move already has a job.' using errcode='22023'; end if;
    event_action:='scheduled';
  else
    select * into job_record from public.jobs where id=p_job_id for update;
    if not found or job_record.status<>'scheduled' then
      raise exception 'Only scheduled jobs can be edited.' using errcode='22023'; end if;
    if p_expected_revision is null or job_record.revision<>p_expected_revision then
      raise exception 'The job changed. Reload before saving.' using errcode='40001'; end if;
    if p_estimate_id is distinct from job_record.estimate_id then
      raise exception 'The estimate linked to a job cannot be replaced.' using errcode='22023'; end if;
    select * into estimate_record from public.estimates where id=p_estimate_id;
    if estimate_record.status<>'accepted' then raise exception 'An accepted estimate is required.' using errcode='22023'; end if;
    event_action:='rescheduled';
  end if;

  -- Fixed lock order serializes reservations of the same workers/trucks.
  perform 1 from public.profiles where id=any(p_worker_ids) order by id for update;
  if (select count(*) from public.profiles where id=any(p_worker_ids) and role='worker')<>cardinality(p_worker_ids) then
    raise exception 'Choose existing worker accounts.' using errcode='22023'; end if;
  perform 1 from public.trucks where id=p_truck_id for update;
  if not found then raise exception 'Choose an existing truck.' using errcode='22023'; end if;
  if exists(
    select 1 from unnest(p_worker_ids) as w(id) where not exists(
      select 1 from public.worker_availability a where a.worker_id=w.id
        and a.day=extract(isodow from p_date)::integer and a.available
        and a.start_time<=p_start and a.end_time>=p_end
    )
  ) then raise exception 'Every worker must be available for the full work interval.' using errcode='22023'; end if;
  if exists(
    select 1 from public.jobs j join public.job_workers w on w.job_id=j.id
    where w.worker_id=any(p_worker_ids) and j.id<>target_id and j.scheduled_date=p_date
      and j.start_time<p_end and p_start<j.end_time
  ) then raise exception 'A worker overlaps another job.' using errcode='22023'; end if;
  if exists(
    select 1 from public.jobs where truck_id=p_truck_id and id<>target_id and scheduled_date=p_date
      and start_time<p_end and p_start<end_time
  ) then raise exception 'The truck overlaps another job.' using errcode='22023'; end if;

  if p_job_id is not null and job_record.scheduled_date=p_date and job_record.start_time=p_start
    and job_record.end_time=p_end and job_record.arrival_start=p_arrival_start
    and job_record.arrival_end=p_arrival_end and job_record.truck_id=p_truck_id
    and (select array_agg(worker_id order by worker_id) from public.job_workers where job_id=target_id)
      = (select array_agg(id order by id) from unnest(p_worker_ids) as x(id)) then
    return job_record;
  end if;
  if p_job_id is null then
    insert into public.jobs(id,request_id,estimate_id,scheduled_date,start_time,end_time,arrival_start,arrival_end,truck_id)
      values(target_id,estimate_record.request_id,p_estimate_id,p_date,p_start,p_end,p_arrival_start,p_arrival_end,p_truck_id)
      returning * into job_record;
  else
    update public.jobs set scheduled_date=p_date,start_time=p_start,end_time=p_end,
      arrival_start=p_arrival_start,arrival_end=p_arrival_end,truck_id=p_truck_id,
      revision=revision+1,updated_at=now() where id=target_id returning * into job_record;
    delete from public.job_workers where job_id=target_id;
  end if;
  insert into public.job_workers(job_id,worker_id) select target_id,id from unnest(p_worker_ids) as x(id);
  insert into public.job_events(job_id,actor_id,action,details)
    values(target_id,actor,event_action,jsonb_build_object(
      'date',p_date,'start',p_start,'end',p_end,'arrival_start',p_arrival_start,
      'arrival_end',p_arrival_end,'truck_id',p_truck_id,'worker_ids',p_worker_ids,'revision',job_record.revision
    ));
  return job_record;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.save_worker_availability(p_days jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid();
begin
  -- This same worker row is locked by scheduling, preventing a stale availability check.
  perform 1 from public.profiles where id=actor and role='worker' for update;
  if not found then raise exception 'Only workers can save their availability.' using errcode='42501'; end if;
  if p_days is null or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days)<>7 then
    raise exception 'Provide seven daily availability entries.' using errcode='22023';
  end if;
  if (select count(distinct day) from jsonb_to_recordset(p_days) as x(day integer))<>7
    or exists(
      select 1 from jsonb_to_recordset(p_days)
        as x(day integer, available boolean, start_time time, end_time time)
      where day is null or day not between 1 and 7 or available is null
        or start_time is null or end_time is null or start_time>=time '24:00' or end_time>=time '24:00'
        or extract(second from start_time)<>0 or extract(second from end_time)<>0
        or (available and end_time<=start_time)
    ) then raise exception 'Provide valid unique days and same-day availability times.' using errcode='22023'; end if;
  insert into public.worker_availability(worker_id,day,available,start_time,end_time)
    select actor, day, available, start_time, end_time from jsonb_to_recordset(p_days)
      as x(day integer,available boolean,start_time time,end_time time)
    on conflict(worker_id,day) do update set available=excluded.available,
      start_time=excluded.start_time,end_time=excluded.end_time;
end;
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.send_message(p_conversation_id uuid, p_body text, p_request_id uuid)
 RETURNS messages
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION rebel_move_private.worker_can_read_request(p_request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1 from public.jobs j
    join public.job_workers w on w.job_id=j.id
    join public.profiles p on p.id=w.worker_id
    where j.request_id=p_request_id and p.id=auth.uid() and p.role='worker'
  );
$function$;

revoke all on table "public"."conversations" from public, anon, authenticated, service_role;

alter table "public"."conversations" enable row level security;

revoke all on table "public"."estimate_events" from public, anon, authenticated, service_role;

alter table "public"."estimate_events" enable row level security;

revoke all on table "public"."estimate_items" from public, anon, authenticated, service_role;

alter table "public"."estimate_items" enable row level security;

revoke all on table "public"."estimates" from public, anon, authenticated, service_role;

alter table "public"."estimates" enable row level security;

revoke all on table "public"."job_events" from public, anon, authenticated, service_role;

alter table "public"."job_events" enable row level security;

revoke all on table "public"."job_workers" from public, anon, authenticated, service_role;

alter table "public"."job_workers" enable row level security;

revoke all on table "public"."jobs" from public, anon, authenticated, service_role;

alter table "public"."jobs" enable row level security;

revoke all on table "public"."messages" from public, anon, authenticated, service_role;

alter table "public"."messages" enable row level security;

revoke all on table "public"."move_requests" from public, anon, authenticated, service_role;

alter table "public"."move_requests" enable row level security;

revoke all on table "public"."profiles" from public, anon, authenticated, service_role;

alter table "public"."profiles" enable row level security;

revoke all on table "public"."trucks" from public, anon, authenticated, service_role;

alter table "public"."trucks" enable row level security;

revoke all on table "public"."worker_availability" from public, anon, authenticated, service_role;

alter table "public"."worker_availability" enable row level security;

grant INSERT on table "public"."move_requests" to "service_role";

grant SELECT on table "public"."move_requests" to "service_role";

grant UPDATE on table "public"."move_requests" to "service_role";

grant DELETE on table "public"."move_requests" to "service_role";

grant TRUNCATE on table "public"."move_requests" to "service_role";

grant REFERENCES on table "public"."move_requests" to "service_role";

grant TRIGGER on table "public"."move_requests" to "service_role";

grant SELECT on table "public"."move_requests" to "authenticated";

grant INSERT on table "public"."profiles" to "service_role";

grant SELECT on table "public"."profiles" to "service_role";

grant UPDATE on table "public"."profiles" to "service_role";

grant DELETE on table "public"."profiles" to "service_role";

grant TRUNCATE on table "public"."profiles" to "service_role";

grant REFERENCES on table "public"."profiles" to "service_role";

grant TRIGGER on table "public"."profiles" to "service_role";

grant SELECT on table "public"."profiles" to "authenticated";

grant INSERT on table "public"."estimate_items" to "service_role";

grant SELECT on table "public"."estimate_items" to "service_role";

grant UPDATE on table "public"."estimate_items" to "service_role";

grant DELETE on table "public"."estimate_items" to "service_role";

grant TRUNCATE on table "public"."estimate_items" to "service_role";

grant REFERENCES on table "public"."estimate_items" to "service_role";

grant TRIGGER on table "public"."estimate_items" to "service_role";

grant SELECT on table "public"."estimate_items" to "authenticated";

grant INSERT on table "public"."estimates" to "service_role";

grant SELECT on table "public"."estimates" to "service_role";

grant UPDATE on table "public"."estimates" to "service_role";

grant DELETE on table "public"."estimates" to "service_role";

grant TRUNCATE on table "public"."estimates" to "service_role";

grant REFERENCES on table "public"."estimates" to "service_role";

grant TRIGGER on table "public"."estimates" to "service_role";

grant SELECT on table "public"."estimates" to "authenticated";

grant INSERT on table "public"."estimate_events" to "service_role";

grant SELECT on table "public"."estimate_events" to "service_role";

grant UPDATE on table "public"."estimate_events" to "service_role";

grant DELETE on table "public"."estimate_events" to "service_role";

grant TRUNCATE on table "public"."estimate_events" to "service_role";

grant REFERENCES on table "public"."estimate_events" to "service_role";

grant TRIGGER on table "public"."estimate_events" to "service_role";

grant SELECT on table "public"."estimate_events" to "authenticated";

grant INSERT on table "public"."trucks" to "service_role";

grant SELECT on table "public"."trucks" to "service_role";

grant UPDATE on table "public"."trucks" to "service_role";

grant DELETE on table "public"."trucks" to "service_role";

grant TRUNCATE on table "public"."trucks" to "service_role";

grant REFERENCES on table "public"."trucks" to "service_role";

grant TRIGGER on table "public"."trucks" to "service_role";

grant SELECT on table "public"."trucks" to "authenticated";

grant INSERT on table "public"."worker_availability" to "service_role";

grant SELECT on table "public"."worker_availability" to "service_role";

grant UPDATE on table "public"."worker_availability" to "service_role";

grant DELETE on table "public"."worker_availability" to "service_role";

grant TRUNCATE on table "public"."worker_availability" to "service_role";

grant REFERENCES on table "public"."worker_availability" to "service_role";

grant TRIGGER on table "public"."worker_availability" to "service_role";

grant SELECT on table "public"."worker_availability" to "authenticated";

grant INSERT on table "public"."job_workers" to "service_role";

grant SELECT on table "public"."job_workers" to "service_role";

grant UPDATE on table "public"."job_workers" to "service_role";

grant DELETE on table "public"."job_workers" to "service_role";

grant TRUNCATE on table "public"."job_workers" to "service_role";

grant REFERENCES on table "public"."job_workers" to "service_role";

grant TRIGGER on table "public"."job_workers" to "service_role";

grant SELECT on table "public"."job_workers" to "authenticated";

grant INSERT on table "public"."job_events" to "service_role";

grant SELECT on table "public"."job_events" to "service_role";

grant UPDATE on table "public"."job_events" to "service_role";

grant DELETE on table "public"."job_events" to "service_role";

grant TRUNCATE on table "public"."job_events" to "service_role";

grant REFERENCES on table "public"."job_events" to "service_role";

grant TRIGGER on table "public"."job_events" to "service_role";

grant SELECT on table "public"."job_events" to "authenticated";

grant INSERT on table "public"."jobs" to "service_role";

grant SELECT on table "public"."jobs" to "service_role";

grant UPDATE on table "public"."jobs" to "service_role";

grant DELETE on table "public"."jobs" to "service_role";

grant TRUNCATE on table "public"."jobs" to "service_role";

grant REFERENCES on table "public"."jobs" to "service_role";

grant TRIGGER on table "public"."jobs" to "service_role";

grant SELECT on table "public"."jobs" to "authenticated";

grant INSERT on table "public"."conversations" to "service_role";

grant SELECT on table "public"."conversations" to "service_role";

grant UPDATE on table "public"."conversations" to "service_role";

grant DELETE on table "public"."conversations" to "service_role";

grant TRUNCATE on table "public"."conversations" to "service_role";

grant REFERENCES on table "public"."conversations" to "service_role";

grant TRIGGER on table "public"."conversations" to "service_role";

grant SELECT on table "public"."conversations" to "authenticated";

grant INSERT on table "public"."messages" to "service_role";

grant SELECT on table "public"."messages" to "service_role";

grant UPDATE on table "public"."messages" to "service_role";

grant DELETE on table "public"."messages" to "service_role";

grant TRUNCATE on table "public"."messages" to "service_role";

grant REFERENCES on table "public"."messages" to "service_role";

grant TRIGGER on table "public"."messages" to "service_role";

grant SELECT on table "public"."messages" to "authenticated";

grant INSERT ("estimate_id") on table "public"."estimate_items" to "authenticated";

grant INSERT ("destination") on table "public"."move_requests" to "authenticated";

grant INSERT ("amount_cents") on table "public"."estimate_items" to "authenticated";

grant INSERT ("access_details") on table "public"."move_requests" to "authenticated";

grant INSERT ("terms") on table "public"."estimates" to "authenticated";

grant INSERT ("requested_date") on table "public"."move_requests" to "authenticated";

grant INSERT ("request_id") on table "public"."estimates" to "authenticated";

grant INSERT ("property_type") on table "public"."move_requests" to "authenticated";

grant INSERT ("position") on table "public"."estimate_items" to "authenticated";

grant INSERT ("pickup") on table "public"."move_requests" to "authenticated";

grant UPDATE ("phone") on table "public"."profiles" to "authenticated";

grant INSERT ("notes") on table "public"."move_requests" to "authenticated";

grant INSERT ("name") on table "public"."trucks" to "authenticated";

grant INSERT ("move_size") on table "public"."move_requests" to "authenticated";

grant INSERT ("label") on table "public"."estimate_items" to "authenticated";

grant INSERT ("items") on table "public"."move_requests" to "authenticated";

grant INSERT ("inclusions") on table "public"."estimates" to "authenticated";

grant UPDATE ("full_name") on table "public"."profiles" to "authenticated";

grant INSERT ("exclusions") on table "public"."estimates" to "authenticated";

revoke all on function "public"."advance_job"(p_job_id uuid, p_expected_status text, p_expected_revision integer) from public, anon, authenticated, service_role;

grant execute on function "public"."advance_job"(p_job_id uuid, p_expected_status text, p_expected_revision integer) to "service_role";

grant execute on function "public"."advance_job"(p_job_id uuid, p_expected_status text, p_expected_revision integer) to "authenticated";

revoke all on function "public"."create_user_profile"() from public, anon, authenticated, service_role;

grant execute on function "public"."create_user_profile"() to "service_role";

revoke all on function "public"."decide_estimate"(p_estimate_id uuid, p_decision text) from public, anon, authenticated, service_role;

grant execute on function "public"."decide_estimate"(p_estimate_id uuid, p_decision text) to "service_role";

grant execute on function "public"."decide_estimate"(p_estimate_id uuid, p_decision text) to "authenticated";

revoke all on function "public"."get_conversation_people"(p_conversation_id uuid) from public, anon, authenticated, service_role;

grant execute on function "public"."get_conversation_people"(p_conversation_id uuid) to "service_role";

grant execute on function "public"."get_conversation_people"(p_conversation_id uuid) to "authenticated";

revoke all on function "public"."get_job_team"(p_job_id uuid) from public, anon, authenticated, service_role;

grant execute on function "public"."get_job_team"(p_job_id uuid) to "service_role";

grant execute on function "public"."get_job_team"(p_job_id uuid) to "authenticated";

revoke all on function "public"."open_conversation"(p_kind text, p_target_id uuid) from public, anon, authenticated, service_role;

grant execute on function "public"."open_conversation"(p_kind text, p_target_id uuid) to "service_role";

grant execute on function "public"."open_conversation"(p_kind text, p_target_id uuid) to "authenticated";

revoke all on function "public"."publish_estimate"(p_estimate_id uuid) from public, anon, authenticated, service_role;

grant execute on function "public"."publish_estimate"(p_estimate_id uuid) to "service_role";

grant execute on function "public"."publish_estimate"(p_estimate_id uuid) to "authenticated";

revoke all on function "public"."publish_reviewed_estimate"(p_estimate_id uuid, p_revision integer) from public, anon, authenticated, service_role;

grant execute on function "public"."publish_reviewed_estimate"(p_estimate_id uuid, p_revision integer) to "service_role";

grant execute on function "public"."publish_reviewed_estimate"(p_estimate_id uuid, p_revision integer) to "authenticated";

revoke all on function "public"."save_estimate_draft"(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb) from public, anon, authenticated, service_role;

grant execute on function "public"."save_estimate_draft"(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb) to "service_role";

grant execute on function "public"."save_estimate_draft"(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb) to "authenticated";

revoke all on function "public"."save_job"(p_estimate_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_arrival_start time without time zone, p_arrival_end time without time zone, p_worker_ids uuid[], p_truck_id uuid, p_job_id uuid, p_expected_revision integer) from public, anon, authenticated, service_role;

grant execute on function "public"."save_job"(p_estimate_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_arrival_start time without time zone, p_arrival_end time without time zone, p_worker_ids uuid[], p_truck_id uuid, p_job_id uuid, p_expected_revision integer) to "service_role";

grant execute on function "public"."save_job"(p_estimate_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_arrival_start time without time zone, p_arrival_end time without time zone, p_worker_ids uuid[], p_truck_id uuid, p_job_id uuid, p_expected_revision integer) to "authenticated";

revoke all on function "public"."save_worker_availability"(p_days jsonb) from public, anon, authenticated, service_role;

grant execute on function "public"."save_worker_availability"(p_days jsonb) to "service_role";

grant execute on function "public"."save_worker_availability"(p_days jsonb) to "authenticated";

revoke all on function "public"."send_message"(p_conversation_id uuid, p_body text, p_request_id uuid) from public, anon, authenticated, service_role;

grant execute on function "public"."send_message"(p_conversation_id uuid, p_body text, p_request_id uuid) to "service_role";

grant execute on function "public"."send_message"(p_conversation_id uuid, p_body text, p_request_id uuid) to "authenticated";

revoke all on function "rebel_move_private"."advance_job"(p_job_id uuid, p_expected_status text, p_expected_revision integer) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."advance_job"(p_job_id uuid, p_expected_status text, p_expected_revision integer) to "authenticated";

revoke all on function "rebel_move_private"."can_read_conversation"(p_id uuid) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."can_read_conversation"(p_id uuid) to "authenticated";

revoke all on function "rebel_move_private"."can_read_job"(p_job_id uuid) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."can_read_job"(p_job_id uuid) to "authenticated";

revoke all on function "rebel_move_private"."decide_estimate"(p_estimate_id uuid, p_decision text) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."decide_estimate"(p_estimate_id uuid, p_decision text) to "authenticated";

revoke all on function "rebel_move_private"."get_conversation_people"(p_conversation_id uuid) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."get_conversation_people"(p_conversation_id uuid) to "authenticated";

revoke all on function "rebel_move_private"."get_job_team"(p_job_id uuid) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."get_job_team"(p_job_id uuid) to "authenticated";

revoke all on function "rebel_move_private"."guard_pricing_insert"() from public, anon, authenticated, service_role;

revoke all on function "rebel_move_private"."is_admin"() from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."is_admin"() to "authenticated";

revoke all on function "rebel_move_private"."open_conversation"(p_kind text, p_target_id uuid) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."open_conversation"(p_kind text, p_target_id uuid) to "authenticated";

revoke all on function "rebel_move_private"."publish_estimate"(p_estimate_id uuid) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."publish_estimate"(p_estimate_id uuid) to "authenticated";

revoke all on function "rebel_move_private"."publish_reviewed_estimate"(p_estimate_id uuid, p_revision integer) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."publish_reviewed_estimate"(p_estimate_id uuid, p_revision integer) to "authenticated";

revoke all on function "rebel_move_private"."save_estimate_draft"(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."save_estimate_draft"(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb) to "authenticated";

revoke all on function "rebel_move_private"."save_job"(p_estimate_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_arrival_start time without time zone, p_arrival_end time without time zone, p_worker_ids uuid[], p_truck_id uuid, p_job_id uuid, p_expected_revision integer) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."save_job"(p_estimate_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_arrival_start time without time zone, p_arrival_end time without time zone, p_worker_ids uuid[], p_truck_id uuid, p_job_id uuid, p_expected_revision integer) to "authenticated";

revoke all on function "rebel_move_private"."save_worker_availability"(p_days jsonb) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."save_worker_availability"(p_days jsonb) to "authenticated";

revoke all on function "rebel_move_private"."send_message"(p_conversation_id uuid, p_body text, p_request_id uuid) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."send_message"(p_conversation_id uuid, p_body text, p_request_id uuid) to "authenticated";

revoke all on function "rebel_move_private"."worker_can_read_request"(p_request_id uuid) from public, anon, authenticated, service_role;

grant execute on function "rebel_move_private"."worker_can_read_request"(p_request_id uuid) to "authenticated";

create policy "Assigned workers can read request details" on "public"."move_requests" as PERMISSIVE for SELECT to "authenticated" using (rebel_move_private.worker_can_read_request(id));

create policy "Customers and administrators can read requests" on "public"."move_requests" as PERMISSIVE for SELECT to "authenticated" using (((customer_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))));

create policy "Customers can create their own requests" on "public"."move_requests" as PERMISSIVE for INSERT to "authenticated" with check (((customer_id = ( SELECT auth.uid() AS uid)) AND (requested_date >= ((now() AT TIME ZONE 'America/Chicago'::text))::date) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'customer'::text))))));

create policy "Administrators can read profiles" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using (( SELECT rebel_move_private.is_admin() AS is_admin));

create policy "Users can edit their own contact details" on "public"."profiles" as PERMISSIVE for UPDATE to "authenticated" using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));

create policy "Users can read their own profile" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using ((id = ( SELECT auth.uid() AS uid)));

create policy "Administrators can add draft estimate items" on "public"."estimate_items" as PERMISSIVE for INSERT to "authenticated" with check (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) AND (EXISTS ( SELECT 1
   FROM estimates
  WHERE ((estimates.id = estimate_items.estimate_id) AND (estimates.status = 'draft'::text))))));

create policy "Read items for accessible estimates" on "public"."estimate_items" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM estimates
  WHERE (estimates.id = estimate_items.estimate_id))));

create policy "Administrators can create estimate drafts" on "public"."estimates" as PERMISSIVE for INSERT to "authenticated" with check (((status = 'draft'::text) AND (created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))));

create policy "Administrators can read all estimates" on "public"."estimates" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));

create policy "Customers can read their published estimates" on "public"."estimates" as PERMISSIVE for SELECT to "authenticated" using (((status <> 'draft'::text) AND (EXISTS ( SELECT 1
   FROM move_requests
  WHERE ((move_requests.id = estimates.request_id) AND (move_requests.customer_id = ( SELECT auth.uid() AS uid)))))));

create policy "Read events for accessible estimates" on "public"."estimate_events" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM estimates
  WHERE (estimates.id = estimate_events.estimate_id))));

create policy "Administrators can add trucks" on "public"."trucks" as PERMISSIVE for INSERT to "authenticated" with check (( SELECT rebel_move_private.is_admin() AS is_admin));

create policy "Read trucks for accessible jobs or administer trucks" on "public"."trucks" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT rebel_move_private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM jobs
  WHERE (jobs.truck_id = trucks.id)))));

create policy "Read own availability or administer availability" on "public"."worker_availability" as PERMISSIVE for SELECT to "authenticated" using (((worker_id = ( SELECT auth.uid() AS uid)) OR ( SELECT rebel_move_private.is_admin() AS is_admin)));

create policy "Read accessible crews" on "public"."job_workers" as PERMISSIVE for SELECT to "authenticated" using (rebel_move_private.can_read_job(job_id));

create policy "Read accessible job events" on "public"."job_events" as PERMISSIVE for SELECT to "authenticated" using (rebel_move_private.can_read_job(job_id));

create policy "Read accessible jobs" on "public"."jobs" as PERMISSIVE for SELECT to "authenticated" using (rebel_move_private.can_read_job(id));

create policy "Read accessible conversations" on "public"."conversations" as PERMISSIVE for SELECT to "authenticated" using (rebel_move_private.can_read_conversation(id));

create policy "Read accessible messages" on "public"."messages" as PERMISSIVE for SELECT to "authenticated" using (rebel_move_private.can_read_conversation(conversation_id));

CREATE INDEX messages_conversation_history_idx ON public.messages USING btree (conversation_id, created_at, id);

CREATE INDEX job_events_job_id_idx ON public.job_events USING btree (job_id);

CREATE INDEX estimates_created_by_idx ON public.estimates USING btree (created_by);

CREATE INDEX conversations_owner_idx ON public.conversations USING btree (owner_id);

CREATE INDEX move_requests_customer_id_idx ON public.move_requests USING btree (customer_id);

CREATE INDEX jobs_truck_date_idx ON public.jobs USING btree (truck_id, scheduled_date);

CREATE INDEX job_events_actor_id_idx ON public.job_events USING btree (actor_id);

CREATE INDEX estimate_events_estimate_id_idx ON public.estimate_events USING btree (estimate_id);

CREATE INDEX estimate_events_actor_id_idx ON public.estimate_events USING btree (actor_id);

CREATE INDEX jobs_estimate_request_idx ON public.jobs USING btree (estimate_id, request_id);

CREATE INDEX job_workers_worker_id_idx ON public.job_workers USING btree (worker_id, job_id);

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_user_profile();

CREATE TRIGGER guard_pricing_insert BEFORE INSERT ON public.estimate_items FOR EACH ROW EXECUTE FUNCTION rebel_move_private.guard_pricing_insert();

alter publication supabase_realtime add table "public"."jobs";

alter publication supabase_realtime add table "public"."messages";

set check_function_bodies = true;
