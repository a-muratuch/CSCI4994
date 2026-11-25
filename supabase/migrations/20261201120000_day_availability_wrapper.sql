-- Follow-up to Phase 8E: keep the privileged day-hint query in the private
-- schema behind a security-invoker public wrapper, like every other function
-- in this project. Same behaviour and output; clears the Supabase advisor
-- warning about a SECURITY DEFINER function in the public API.
-- Apply to the hosted project only after owner approval.
begin;

create function rebel_move_private.day_availability(p_from date, p_days integer) returns table(day date, status text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform rebel_move_private.require_active_account();
  if p_from is null or p_days is null or p_days not between 1 and 62
     or p_from < (now() at time zone 'America/Chicago')::date then
    raise exception 'Choose up to 62 days from today' using errcode = '22023'; end if;
  return query
  select d::date, case when remaining <= 0 then 'full' when remaining = 1 then 'limited' else 'open' end
  from (
    select d, least((select count(*) from public.trucks where active),
        (select count(*) from public.profiles pr join public.worker_availability a on a.worker_id = pr.id
          where pr.role = 'worker' and pr.active and a.available and a.day = extract(isodow from d)::integer)) * 2
      - (select count(*) from public.jobs j where j.scheduled_date = d::date and j.status <> 'cancelled') as remaining
    from generate_series(p_from, p_from + (p_days - 1), interval '1 day') as d
  ) days;
end $$;

drop function public.day_availability(date, integer);
create function public.day_availability(p_from date, p_days integer) returns table(day date, status text)
language sql stable security invoker set search_path='' as $$
  select * from rebel_move_private.day_availability(p_from, p_days); $$;

revoke all on function rebel_move_private.day_availability(date,integer), public.day_availability(date,integer)
  from public, anon, authenticated;
grant execute on function rebel_move_private.day_availability(date,integer), public.day_availability(date,integer)
  to authenticated;

commit;
