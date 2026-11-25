-- Phase 8D: the customer's preferred arrival window on a move request.
-- Additive only; apply to the hosted project only after owner approval.
-- A preference, not a booking: administrators still confirm the schedule.
begin;

alter table public.move_requests
  add column preferred_window text check (preferred_window in ('morning','midday','afternoon'));

-- Customer: set or clear the window on their own pending request, with the
-- same revision and "no published estimate" rules as the inventory list.
create function rebel_move_private.set_request_window(p_request_id uuid, p_revision integer, p_window text) returns void
language plpgsql security definer set search_path='' as $$
declare saved public.move_requests%rowtype;
begin
  perform rebel_move_private.require_active_account();
  if p_window is not null and p_window not in ('morning','midday','afternoon') then
    raise exception 'Choose morning, midday or afternoon' using errcode = '22023'; end if;
  select * into saved from public.move_requests where id = p_request_id for update;
  if not found or saved.customer_id is distinct from auth.uid() then
    raise exception 'Request unavailable' using errcode = '42501'; end if;
  if saved.revision is distinct from p_revision or saved.status <> 'pending'
     or exists (select 1 from public.estimates where request_id = p_request_id and published_at is not null) then
    raise exception 'Request changed or estimate published' using errcode = '40001'; end if;
  update public.move_requests set preferred_window = p_window where id = p_request_id;
end $$;

create function public.set_request_window(p_request_id uuid, p_revision integer, p_window text) returns void
language sql security invoker set search_path='' as $$
  select rebel_move_private.set_request_window(p_request_id, p_revision, p_window); $$;
create function public.arrival_window_capabilities() returns integer
language sql stable security invoker set search_path='' as $$ select 12; $$;

revoke all on function rebel_move_private.set_request_window(uuid,integer,text),
  public.set_request_window(uuid,integer,text), public.arrival_window_capabilities()
  from public, anon, authenticated;
grant execute on function rebel_move_private.set_request_window(uuid,integer,text),
  public.set_request_window(uuid,integer,text), public.arrival_window_capabilities()
  to authenticated;

commit;
