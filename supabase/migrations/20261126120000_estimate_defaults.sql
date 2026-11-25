-- Phase 8B: standard estimate text saved once in pricing settings. Additive only.
-- Apply to the hosted project only after owner approval. Requires Phase 7A.
-- New estimate drafts start from these lists and terms; saved estimates keep
-- their own copies, so changing the defaults never changes an estimate.
begin;

alter table public.pricing_settings
  add column default_inclusions text[] not null default array[
    'Loading and unloading of the listed items',
    'Truck, fuel and equipment for the listed route',
    'Furniture pads and basic wrapping'],
  add column default_exclusions text[] not null default array[
    'Packing services unless listed',
    'Storage',
    'Items not listed in the request'],
  add column default_terms text not null default
    'These terms are not a binding quote. No payment is collected. Acceptance does not confirm a date; an admin must schedule the move and assign resources.',
  -- Same limits as estimates: 1–20 list items and terms up to 2,000 characters.
  add constraint pricing_settings_default_text check (
    cardinality(default_inclusions) between 1 and 20
    and cardinality(default_exclusions) between 1 and 20
    and char_length(btrim(default_terms)) between 1 and 2000);

-- Administrators replace the standard text. Items are trimmed and each must
-- be 1–500 characters, matching estimate validation.
create function rebel_move_private.save_estimate_defaults(p_inclusions text[], p_exclusions text[], p_terms text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not rebel_move_private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_inclusions is null or p_exclusions is null or p_terms is null
     or exists (select 1 from unnest(p_inclusions || p_exclusions) as item(value)
                where value is null or char_length(btrim(value)) not between 1 and 500) then
    raise exception 'Provide 1–20 items of up to 500 characters and terms up to 2,000 characters' using errcode = '22023';
  end if;
  update public.pricing_settings set
    default_inclusions = (select array_agg(btrim(v) order by n) from unnest(p_inclusions) with ordinality as i(v, n)),
    default_exclusions = (select array_agg(btrim(v) order by n) from unnest(p_exclusions) with ordinality as e(v, n)),
    default_terms = btrim(p_terms), updated_at = now(), updated_by = auth.uid()
  where id;
exception when check_violation or not_null_violation then
  raise exception 'Provide 1–20 items of up to 500 characters and terms up to 2,000 characters' using errcode = '22023';
end $$;

create function public.save_estimate_defaults(p_inclusions text[], p_exclusions text[], p_terms text) returns void
language sql security invoker set search_path='' as $$
  select rebel_move_private.save_estimate_defaults(p_inclusions, p_exclusions, p_terms); $$;
create function public.estimate_default_capabilities() returns integer
language sql stable security invoker set search_path='' as $$ select 10; $$;

revoke all on function rebel_move_private.save_estimate_defaults(text[],text[],text),
  public.save_estimate_defaults(text[],text[],text), public.estimate_default_capabilities()
  from public, anon, authenticated;
grant execute on function rebel_move_private.save_estimate_defaults(text[],text[],text),
  public.save_estimate_defaults(text[],text[],text), public.estimate_default_capabilities()
  to authenticated;

commit;
