-- Local proposal. Apply to the hosted project only with owner approval.
begin;

create function rebel_move_private.get_job_teams(p_job_ids uuid[])
returns table(job_id uuid, worker_id uuid, full_name text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_job_ids is null or cardinality(p_job_ids) > 500 then
    raise exception 'Provide at most 500 job identifiers.' using errcode = '22023';
  end if;
  if auth.uid() is null or exists (
    select 1 from unnest(p_job_ids) requested(id)
    where requested.id is null or not rebel_move_private.can_read_job(requested.id)
  ) then
    raise exception 'One or more jobs are unavailable.' using errcode = '42501';
  end if;
  return query
    select w.job_id, p.id, p.full_name
    from public.job_workers w join public.profiles p on p.id = w.worker_id
    where w.job_id = any(p_job_ids)
    order by w.job_id, p.full_name, p.id;
end;
$$;

create function public.get_job_teams(p_job_ids uuid[])
returns table(job_id uuid, worker_id uuid, full_name text)
language sql stable security invoker set search_path = ''
as $$ select * from rebel_move_private.get_job_teams(p_job_ids); $$;

revoke all on function rebel_move_private.get_job_teams(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.get_job_teams(uuid[]) from public, anon, authenticated, service_role;
grant execute on function rebel_move_private.get_job_teams(uuid[]) to authenticated;
grant execute on function public.get_job_teams(uuid[]) to authenticated;
commit;
