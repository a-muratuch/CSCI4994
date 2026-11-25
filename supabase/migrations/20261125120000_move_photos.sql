-- Phase 7C: move photos in a private Storage bucket. Additive only.
-- Apply to the hosted project only after owner approval.
-- Rows in public.move_photos are the authority: every Storage read, upload
-- and delete is allowed only when the matching row passes the same checks.
begin;

-- Private bucket; the server streams images after checking access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('move-photos', 'move-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create table public.move_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.move_requests(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  stage text not null check (stage in ('request','pickup','delivery')),
  uploaded_by uuid not null references public.profiles(id),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default clock_timestamp(),
  -- Request photos belong to the request; condition photos belong to a job.
  check ((stage = 'request') = (job_id is null))
);
create index move_photos_request on public.move_photos (request_id, created_at);
create index move_photos_job on public.move_photos (job_id, stage) where job_id is not null;
create index move_photos_uploader on public.move_photos (uploaded_by, created_at);

-- Object names are the photo id, so policies can find the row.
create function rebel_move_private.photo_id(p_name text) returns uuid
language sql immutable set search_path='' as $$
  select case when p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_name::uuid end;
$$;

-- Administrators; the customer who owns the request; workers assigned to
-- the job (condition photos) or to any job for the request (request photos).
create function rebel_move_private.can_read_photo(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select rebel_move_private.active_account() and exists (
    select 1 from public.move_photos m
    join public.move_requests r on r.id = m.request_id
    join public.profiles p on p.id = auth.uid()
    where m.id = p_id and (
      p.role = 'admin'
      or (p.role = 'customer' and r.customer_id = p.id)
      or (p.role = 'worker' and case when m.job_id is null
            then rebel_move_private.worker_can_read_request(m.request_id)
            else exists (select 1 from public.job_workers w where w.job_id = m.job_id and w.worker_id = p.id) end)
    ));
$$;

-- Uploaders may remove their own photo while its stage is still open:
-- a pending request without a published estimate, or a job in progress.
create function rebel_move_private.can_delete_photo(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select rebel_move_private.active_account() and exists (
    select 1 from public.move_photos m
    join public.move_requests r on r.id = m.request_id
    left join public.jobs j on j.id = m.job_id
    where m.id = p_id and m.uploaded_by = auth.uid() and case
      when m.stage = 'request' then r.status = 'pending'
        and not exists (select 1 from public.estimates e where e.request_id = r.id and e.published_at is not null)
      else j.status = 'in-progress'
        and exists (select 1 from public.job_workers w where w.job_id = j.id and w.worker_id = auth.uid())
    end);
$$;

-- A file may be stored only by its uploader, soon after the row exists.
-- Storage's unique bucket/name index prevents a second file for the same id.
create function rebel_move_private.can_store_photo(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select rebel_move_private.active_account() and exists (
    select 1 from public.move_photos m
    where m.id = p_id and m.uploaded_by = auth.uid() and m.created_at > clock_timestamp() - interval '10 minutes');
$$;

-- Reserve a photo before uploading its file. Checks role, ownership or
-- assignment, the open stage, per-stage limits and an account rate limit.
create function rebel_move_private.add_move_photo(p_request_id uuid, p_job_id uuid, p_stage text,
  p_content_type text, p_size_bytes integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor public.profiles%rowtype; req public.move_requests%rowtype; job public.jobs%rowtype; used bigint; saved uuid;
begin
  perform rebel_move_private.require_active_account();
  -- Locking the profile serializes this account's limit checks.
  select * into actor from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Sign in to add photos' using errcode = '42501'; end if;
  if p_stage is null or p_stage not in ('request','pickup','delivery')
     or p_content_type is null or p_content_type not in ('image/jpeg','image/png','image/webp')
     or p_size_bytes is null or p_size_bytes not between 1 and 5242880 then
    raise exception 'Use a JPEG, PNG or WebP photo up to 5 MB' using errcode = '22023'; end if;
  select * into req from public.move_requests where id = p_request_id for update;
  if not found then raise exception 'Move unavailable' using errcode = '42501'; end if;

  if p_stage = 'request' then
    if actor.role <> 'customer' or req.customer_id <> actor.id or p_job_id is not null then
      raise exception 'Move unavailable' using errcode = '42501'; end if;
    if req.status <> 'pending'
       or exists (select 1 from public.estimates where request_id = req.id and published_at is not null) then
      raise exception 'Photos can be added only before an estimate is published' using errcode = '22023'; end if;
    select count(*) into used from public.move_photos where request_id = req.id and stage = 'request';
    if used >= 10 then raise exception 'A request can have up to 10 photos' using errcode = '22023'; end if;
  else
    select * into job from public.jobs where id = p_job_id for update;
    if not found or job.request_id <> req.id or actor.role <> 'worker'
       or not exists (select 1 from public.job_workers where job_id = job.id and worker_id = actor.id) then
      raise exception 'Job unavailable' using errcode = '42501'; end if;
    if job.status <> 'in-progress' then
      raise exception 'Condition photos can be added only while the job is in progress' using errcode = '22023'; end if;
    select count(*) into used from public.move_photos where job_id = job.id and stage = p_stage;
    if used >= 20 then raise exception 'Each job stage can have up to 20 photos' using errcode = '22023'; end if;
  end if;

  select count(*) into used from public.move_photos
    where uploaded_by = actor.id and created_at > clock_timestamp() - interval '10 minutes';
  if used >= 30 then raise exception 'Photo rate exceeded' using errcode = 'P0001', hint = 'rate_limit'; end if;

  insert into public.move_photos(request_id, job_id, stage, uploaded_by, content_type, size_bytes)
  values (req.id, case when p_stage = 'request' then null else job.id end, p_stage, actor.id, p_content_type, p_size_bytes)
  returning id into saved;
  return saved;
end $$;

-- Remove a photo record. The server removes the stored file first (allowed
-- by the same check), so a refused delete leaves both in place.
create function rebel_move_private.delete_move_photo(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform rebel_move_private.require_active_account();
  if not rebel_move_private.can_delete_photo(p_id) then
    raise exception 'This photo can no longer be removed' using errcode = '42501'; end if;
  delete from public.move_photos where id = p_id;
end $$;

alter table public.move_photos enable row level security;
create policy active_account_required on public.move_photos as restrictive for all to authenticated
  using ((select rebel_move_private.active_account())) with check ((select rebel_move_private.active_account()));
create policy "Read accessible move photos" on public.move_photos for select to authenticated
  using (rebel_move_private.can_read_photo(id));
revoke all on public.move_photos from public, anon, authenticated;
grant select on public.move_photos to authenticated;

-- Storage policies: the bucket is private and every object needs its row.
create policy "Read accessible move photo files" on storage.objects for select to authenticated
  using (bucket_id = 'move-photos' and rebel_move_private.can_read_photo(rebel_move_private.photo_id(name)));
create policy "Store reserved move photo files" on storage.objects for insert to authenticated
  with check (bucket_id = 'move-photos' and rebel_move_private.can_store_photo(rebel_move_private.photo_id(name)));
create policy "Remove open move photo files" on storage.objects for delete to authenticated
  using (bucket_id = 'move-photos' and rebel_move_private.can_delete_photo(rebel_move_private.photo_id(name)));

create function public.add_move_photo(p_request_id uuid, p_job_id uuid, p_stage text, p_content_type text, p_size_bytes integer) returns uuid
language sql security invoker set search_path='' as $$
  select rebel_move_private.add_move_photo(p_request_id, p_job_id, p_stage, p_content_type, p_size_bytes); $$;
create function public.delete_move_photo(p_id uuid) returns void
language sql security invoker set search_path='' as $$ select rebel_move_private.delete_move_photo(p_id); $$;
create function public.can_delete_move_photo(p_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$ select rebel_move_private.can_delete_photo(p_id); $$;
create function public.photo_capabilities() returns integer language sql stable security invoker set search_path='' as $$ select 9; $$;

revoke all on function rebel_move_private.photo_id(text), rebel_move_private.can_read_photo(uuid),
  rebel_move_private.can_delete_photo(uuid), rebel_move_private.can_store_photo(uuid),
  rebel_move_private.add_move_photo(uuid,uuid,text,text,integer), rebel_move_private.delete_move_photo(uuid),
  public.add_move_photo(uuid,uuid,text,text,integer), public.delete_move_photo(uuid), public.can_delete_move_photo(uuid),
  public.photo_capabilities()
  from public, anon, authenticated;
grant execute on function rebel_move_private.photo_id(text), rebel_move_private.can_read_photo(uuid),
  rebel_move_private.can_delete_photo(uuid), rebel_move_private.can_store_photo(uuid),
  rebel_move_private.add_move_photo(uuid,uuid,text,text,integer), rebel_move_private.delete_move_photo(uuid),
  public.add_move_photo(uuid,uuid,text,text,integer), public.delete_move_photo(uuid), public.can_delete_move_photo(uuid),
  public.photo_capabilities()
  to authenticated;

commit;
