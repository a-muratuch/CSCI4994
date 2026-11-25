begin;
create function rebel_move_private.admin_records(p_kind text,p_search text default '',p_status text default '',p_sort text default 'newest',p_page integer default 1)
returns table(id uuid,request_id uuid,customer text,pickup text,destination text,record_date date,status text,created_at timestamptz,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_kind not in ('requests','estimates','jobs') or p_sort not in ('newest','oldest','date','customer') or p_page not between 1 and 1000000 or char_length(p_search)>100 then raise exception 'Invalid filters' using errcode='22023'; end if;
 return query with records as (
 select r.id,r.id as request_id,p.full_name as customer,r.pickup,r.destination,r.requested_date as record_date,
 case when r.status='cancelled' then 'cancelled' when j.id is not null then j.status when e.status='awaiting' then 'estimate-ready' when e.status='accepted' then 'awaiting-scheduling' when e.status='declined' then 'coordinator-review' when e.status='draft' then 'estimate-draft' else 'requested' end as status,r.created_at
 from public.move_requests r join public.profiles p on p.id=r.customer_id
 left join public.estimates e on e.request_id=r.id and e.is_current left join public.jobs j on j.request_id=r.id where p_kind='requests'
 union all
 select e.id,r.id,p.full_name,r.pickup,r.destination,r.requested_date,e.status,e.created_at
 from public.estimates e join public.move_requests r on r.id=e.request_id join public.profiles p on p.id=r.customer_id where p_kind='estimates'
 union all
 select j.id,r.id,p.full_name,r.pickup,r.destination,j.scheduled_date,j.status,j.created_at
 from public.jobs j join public.move_requests r on r.id=j.request_id join public.profiles p on p.id=r.customer_id where p_kind='jobs'
 ), filtered as (select x.* from records x where (p_status='' or x.status=p_status)
 and (p_search='' or (x.customer||' '||x.pickup||' '||x.destination||' '||x.id::text) ilike '%'||replace(replace(replace(p_search,'\','\\'),'%','\%'),'_','\_')||'%'))
 select f.*,count(*) over() from filtered f order by
 case when p_sort='newest' then f.created_at end desc,
 case when p_sort='oldest' then f.created_at end asc,
 case when p_sort='date' then f.record_date end asc,
 case when p_sort='customer' then f.customer end asc,f.id limit 20 offset (p_page-1)*20;
end $$;
create function public.admin_records(p_kind text,p_search text default '',p_status text default '',p_sort text default 'newest',p_page integer default 1)
returns table(id uuid,request_id uuid,customer text,pickup text,destination text,record_date date,status text,created_at timestamptz,total_count bigint)
language sql stable security invoker set search_path='' as $$ select * from rebel_move_private.admin_records(p_kind,p_search,p_status,p_sort,p_page); $$;
create function rebel_move_private.admin_activity(p_kind text default '',p_action text default '',p_page integer default 1)
returns table(id uuid,entity text,record_id uuid,action text,actor text,occurred_at timestamptz,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_kind not in ('','estimate','job') or p_page not between 1 and 1000000 or char_length(p_action)>40 then raise exception 'Invalid filters' using errcode='22023'; end if;
 return query with events as (
 select e.id,'estimate'::text as entity,e.estimate_id as record_id,e.new_status as action,p.full_name as actor,e.occurred_at from public.estimate_events e join public.profiles p on p.id=e.actor_id
 union all select e.id,'job',e.job_id,e.action,p.full_name,e.occurred_at from public.job_events e join public.profiles p on p.id=e.actor_id
 ),filtered as(select x.* from events x where (p_kind='' or x.entity=p_kind) and (p_action='' or x.action=p_action))
 select f.*,count(*) over() from filtered f order by f.occurred_at desc,f.id desc limit 20 offset (p_page-1)*20;
end $$;
create function public.admin_activity(p_kind text default '',p_action text default '',p_page integer default 1)
returns table(id uuid,entity text,record_id uuid,action text,actor text,occurred_at timestamptz,total_count bigint)
language sql stable security invoker set search_path='' as $$ select * from rebel_move_private.admin_activity(p_kind,p_action,p_page); $$;
revoke all on function public.admin_records(text,text,text,text,integer),rebel_move_private.admin_records(text,text,text,text,integer),public.admin_activity(text,text,integer),rebel_move_private.admin_activity(text,text,integer) from public,anon,authenticated;
grant execute on function public.admin_records(text,text,text,text,integer),rebel_move_private.admin_records(text,text,text,text,integer),public.admin_activity(text,text,integer),rebel_move_private.admin_activity(text,text,integer) to authenticated;
-- Enable the UI only after every Phase 4 function has been installed.
create function public.workflow_capabilities() returns integer language sql stable security invoker set search_path='' as $$ select 4; $$;
revoke all on function public.workflow_capabilities() from public,anon;
grant execute on function public.workflow_capabilities() to authenticated;
commit;
