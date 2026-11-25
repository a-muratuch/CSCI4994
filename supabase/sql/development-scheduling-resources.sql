-- Proposed development fixtures. Apply only after the owner's setup approval.
-- Worker roles were assigned separately at the owner's request; never alter admin here.
begin;
do $$
begin
  if (select count(*) from public.profiles where id in
      ('b1a02071-b606-4ac1-a624-98cfa71e43f4','5ca6f5ea-6dd3-459e-8f9d-de034a921bc1') and role='worker')<>2 then
    raise exception 'Both approved development workers must exist';
  end if;
end $$;
insert into public.worker_availability(worker_id,day,available,start_time,end_time)
select w.id,d.day,d.day<=5,time '08:00',time '17:00'
from public.profiles w cross join generate_series(1,7) d(day)
where w.id in ('b1a02071-b606-4ac1-a624-98cfa71e43f4','5ca6f5ea-6dd3-459e-8f9d-de034a921bc1')
on conflict(worker_id,day) do nothing;
lock table public.trucks in share row exclusive mode;
insert into public.trucks(name) select name from (values('Truck A'),('Truck B')) as proposed(name)
where not exists(select 1 from public.trucks t where t.name=proposed.name);
commit;
