-- Notification recipient FKs take KEY SHARE locks. NO KEY UPDATE still serializes
-- each actor's rate checks while permitting those non-key-changing FK reads.
-- Apply to hosted projects only with separate owner approval.
begin;
create or replace function rebel_move_private.limit_creations() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid; used bigint;
begin
 if tg_table_name='messages' then actor:=new.sender_id;else actor:=new.customer_id;end if;
 if auth.uid() is null then return new;end if; -- trusted fixtures/maintenance only
 perform rebel_move_private.require_active_account();
 if actor is distinct from auth.uid() then raise exception 'Cannot create for another account' using errcode='42501';end if;
 perform 1 from public.profiles where id=actor for no key update;
 if tg_table_name='messages' then
  -- Idempotent message retries must still succeed at the quota boundary.
  if exists(select 1 from public.messages where sender_id=actor and request_id=new.request_id) then return new;end if;
  select count(*) into used from public.messages where sender_id=actor and created_at>clock_timestamp()-interval '1 minute';
  if used>=30 then raise exception 'Message rate exceeded' using errcode='P0001',hint='rate_limit';end if;
 else
  select count(*) into used from public.move_requests where customer_id=actor and created_at>clock_timestamp()-interval '10 minutes';
  if used>=5 then raise exception 'Request rate exceeded' using errcode='P0001',hint='rate_limit';end if;
 end if;
 new.created_at:=clock_timestamp();
 return new;
end $$;
commit;
