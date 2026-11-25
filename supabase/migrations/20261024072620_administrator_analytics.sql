-- Additive analytics only. Apply to the hosted project only after owner approval.
begin;
create view public.analytics_requests with (security_invoker=true,security_barrier=true) as
select r.id, (r.created_at at time zone 'America/Chicago')::date as requested_on,
 r.status='cancelled' as cancelled, e.published, a.accepted_on, a.total_cents as accepted_cents,
 exists(select 1 from public.jobs j where j.request_id=r.id) as scheduled,
 exists(select 1 from public.jobs j where j.request_id=r.id and j.status='completed') as completed
from public.move_requests r
left join lateral (select bool_or(x.published_at is not null) as published from public.estimates x where x.request_id=r.id) e on true
left join lateral (
 select (x.decided_at at time zone 'America/Chicago')::date as accepted_on,x.total_cents
 from public.estimates x where x.request_id=r.id and x.status='accepted' and x.decided_at is not null
 order by x.decided_at,x.id limit 1
) a on true
where (select rebel_move_private.is_admin());
create view public.analytics_jobs with (security_invoker=true,security_barrier=true) as
select j.id,j.scheduled_date,j.status,
 extract(epoch from (j.end_time-j.start_time))/3600 as work_hours
from public.jobs j where j.status<>'cancelled' and (select rebel_move_private.is_admin());
create view public.analytics_crew with (security_invoker=true,security_barrier=true) as
select w.worker_id,p.full_name,p.active,j.id as job_id,j.scheduled_date,j.work_hours
from public.analytics_jobs j join public.job_workers w on w.job_id=j.id
join public.profiles p on p.id=w.worker_id
where (select rebel_move_private.is_admin());
revoke all on public.analytics_requests,public.analytics_jobs,public.analytics_crew from public,anon,authenticated;
grant select on public.analytics_requests,public.analytics_jobs,public.analytics_crew to authenticated;

create function public.admin_analytics(p_weeks integer default 8) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare first_day date; last_day date; result jsonb;
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_weeks is null or p_weeks not in (4,8,12) then raise exception 'Choose 4, 8 or 12 weeks' using errcode='22023';end if;
 first_day:=date_trunc('week',now() at time zone 'America/Chicago')::date-(p_weeks-1)*7;
 last_day:=first_day+p_weeks*7-1;
 with cohort as (select * from public.analytics_requests where requested_on between first_day and last_day),
 accepted as (select * from public.analytics_requests where accepted_on between first_day and last_day),
 booked as (select * from public.analytics_jobs where scheduled_date between first_day and last_day),
 weeks as (select first_day+n*7 as day from generate_series(0,p_weeks-1) n)
 select jsonb_build_object(
 'start',first_day,'end',last_day,'asOf',now(),
 'requests',(select count(*) from cohort),
 'acceptedRequests',(select count(*) from cohort where accepted_on is not null),
 'acceptedCount',(select count(*) from accepted),
 'acceptedCents',(select coalesce(sum(accepted_cents),0) from accepted),
 'jobs',(select count(*) from booked),
 'funnel',jsonb_build_array(
  (select count(*) from cohort),
  (select count(*) from cohort where published),
  (select count(*) from cohort where accepted_on is not null),
  (select count(*) from cohort where scheduled),
  (select count(*) from cohort where completed)),
 'weekly',(select jsonb_agg(jsonb_build_object('date',day,
  'requests',(select count(*) from cohort where requested_on>=day and requested_on<day+7),
  'jobs',(select count(*) from booked where scheduled_date>=day and scheduled_date<day+7)) order by day) from weeks),
 'crew',(select coalesce(jsonb_agg(to_jsonb(c) order by c.hours desc,c.name,c.id),'[]'::jsonb) from (
  select worker_id as id,coalesce(nullif(trim(full_name),''),'Worker') as name,bool_and(active) as active,
   round(sum(work_hours),2) as hours,count(*) as jobs
  from public.analytics_crew where scheduled_date between first_day and last_day group by worker_id,full_name
 ) c)
 ) into result;
 return result;
end $$;
revoke all on function public.admin_analytics(integer) from public,anon,authenticated;
grant execute on function public.admin_analytics(integer) to authenticated;
commit;
