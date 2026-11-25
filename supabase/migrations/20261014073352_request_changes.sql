-- Local proposal: preserves legacy free-text addresses; new addresses are structured.
begin;
alter table public.job_events drop constraint job_events_action_check;
alter table public.job_events add constraint job_events_action_check check (action in ('scheduled','rescheduled','in-progress','completed','cancelled'));
create function rebel_move_private.change_request(p_id uuid,p_revision integer,p_input jsonb,p_cancel boolean default false) returns public.move_requests
language plpgsql security definer set search_path='' as $$
declare saved public.move_requests%rowtype; actor uuid:=auth.uid(); a jsonb; field text;
begin
 if not exists(select 1 from public.profiles where id=actor and role='customer') then raise exception 'Customer required' using errcode='42501'; end if;
 if p_id is not null then
  select * into saved from public.move_requests where id=p_id for update;
  if not found or saved.customer_id<>actor then raise exception 'Request unavailable' using errcode='42501'; end if;
  if saved.revision is distinct from p_revision or saved.status<>'pending' or exists(select 1 from public.estimates where request_id=p_id and published_at is not null) then
   raise exception 'Request changed or estimate published' using errcode='40001'; end if;
  if p_cancel then
   update public.move_requests set status='cancelled',revision=revision+1 where id=p_id returning * into saved;
   insert into public.request_events(request_id,actor_id,action) values(p_id,actor,'cancelled');
   return saved;
  end if;
 elsif p_revision is distinct from 0 or p_cancel then raise exception 'Invalid request context' using errcode='22023'; end if;
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid request' using errcode='22023'; end if;
 foreach field in array array['pickup','destination','requestedDate','property','size','items','access','notes'] loop
  if jsonb_typeof(p_input->field) is distinct from 'string' then raise exception 'Invalid request field' using errcode='22023'; end if;
 end loop;
 if (p_input->>'requestedDate') !~ '^\d{4}-\d{2}-\d{2}$' or (p_input->>'requestedDate')::date < (now() at time zone 'America/Chicago')::date
 or p_input->>'property' not in ('House','Apartment','Townhouse','Other') then raise exception 'Invalid date or property' using errcode='22023'; end if;
 if p_id is null and (p_input->'pickupAddress' is null or p_input->'destinationAddress' is null) then raise exception 'Complete both addresses' using errcode='22023'; end if;
 foreach a in array array[p_input->'pickupAddress',p_input->'destinationAddress'] loop
  -- Legacy rows can still be edited with the unchanged free-text address.
  if a is not null and a<>'null'::jsonb then
   if jsonb_typeof(a) is distinct from 'object' then raise exception 'Invalid address' using errcode='22023'; end if;
   foreach field in array array['street','city','state','zip'] loop
    if jsonb_typeof(a->field) is distinct from 'string' or char_length(trim(a->>field)) not between 1 and 150 then raise exception 'Invalid address field' using errcode='22023'; end if;
   end loop;
   if (a->>'state') !~ '^[A-Z]{2}$' or (a->>'zip') !~ '^\d{5}(-\d{4})?$' then raise exception 'Invalid state or ZIP' using errcode='22023'; end if;
  end if;
 end loop;
 if p_input->'pickupAddress' is not null then a:=p_input->'pickupAddress';p_input:=jsonb_set(p_input,'{pickup}',to_jsonb(trim(a->>'street')||', '||trim(a->>'city')||', '||trim(a->>'state')||' '||trim(a->>'zip')));end if;
 if p_input->'destinationAddress' is not null then a:=p_input->'destinationAddress';p_input:=jsonb_set(p_input,'{destination}',to_jsonb(trim(a->>'street')||', '||trim(a->>'city')||', '||trim(a->>'state')||' '||trim(a->>'zip')));end if;
 if p_id is null then
  insert into public.move_requests(customer_id,pickup,destination,requested_date,property_type,move_size,items,access_details,notes,pickup_address,destination_address)
  values(actor,trim(p_input->>'pickup'),trim(p_input->>'destination'),(p_input->>'requestedDate')::date,trim(p_input->>'property'),trim(p_input->>'size'),trim(p_input->>'items'),trim(p_input->>'access'),trim(p_input->>'notes'),p_input->'pickupAddress',p_input->'destinationAddress') returning * into saved;
 else
  update public.move_requests set pickup=trim(p_input->>'pickup'),destination=trim(p_input->>'destination'),requested_date=(p_input->>'requestedDate')::date,
   property_type=trim(p_input->>'property'),move_size=trim(p_input->>'size'),items=trim(p_input->>'items'),access_details=trim(p_input->>'access'),notes=trim(p_input->>'notes'),
   pickup_address=p_input->'pickupAddress',destination_address=p_input->'destinationAddress',revision=revision+1 where id=p_id returning * into saved;
  insert into public.request_events(request_id,actor_id,action) values(p_id,actor,'edited');
 end if;
 return saved;
end $$;
create function public.change_request(p_id uuid,p_revision integer,p_input jsonb,p_cancel boolean default false) returns public.move_requests
language sql security invoker set search_path='' as $$ select rebel_move_private.change_request(p_id,p_revision,p_input,p_cancel); $$;
revoke all on function public.change_request(uuid,integer,jsonb,boolean) from public,anon,authenticated;
revoke all on function rebel_move_private.change_request(uuid,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.change_request(uuid,integer,jsonb,boolean),rebel_move_private.change_request(uuid,integer,jsonb,boolean) to authenticated;
commit;
