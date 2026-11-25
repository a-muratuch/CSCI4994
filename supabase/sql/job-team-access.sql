begin;
alter table public.jobs add constraint jobs_finite_date check(isfinite(scheduled_date));

create function rebel_move_private.get_job_team(p_job_id uuid)
returns table(worker_id uuid,full_name text)
language plpgsql security definer set search_path=''
as $$
begin
  if not rebel_move_private.can_read_job(p_job_id) then
    raise exception 'This job is not available to this user.' using errcode='42501';
  end if;
  return query select p.id,p.full_name
    from public.job_workers w join public.profiles p on p.id=w.worker_id
    where w.job_id=p_job_id order by p.full_name,p.id;
end;
$$;
revoke all on function rebel_move_private.get_job_team(uuid) from public, anon, authenticated;
grant execute on function rebel_move_private.get_job_team(uuid) to authenticated;

create function public.get_job_team(p_job_id uuid)
returns table(worker_id uuid,full_name text)
language sql security invoker set search_path=''
as $$ select * from rebel_move_private.get_job_team(p_job_id); $$;
revoke all on function public.get_job_team(uuid) from public, anon, authenticated;
grant execute on function public.get_job_team(uuid) to authenticated;
commit;
