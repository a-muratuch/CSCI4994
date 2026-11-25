-- Keep reviewed-version checks meaningful even for existing direct draft-line inserts.
create or replace function rebel_move_private.guard_pricing_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_status text;
begin
  select status into current_status from public.estimates where id=new.estimate_id for update;
  if not found or current_status<>'draft' then raise exception 'Pricing can only be added to a draft estimate.' using errcode='22023'; end if;
  update public.estimates set revision=revision+1 where id=new.estimate_id;
  return new;
end $$;
