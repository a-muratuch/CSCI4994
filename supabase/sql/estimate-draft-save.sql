-- Incremental hosted migration: atomic draft editing and reviewed-version publication.
alter table public.estimates add column revision integer not null default 1 check (revision > 0);

create function rebel_move_private.save_estimate_draft(p_request_id uuid, p_estimate_id uuid, p_revision integer, p_input jsonb)
returns public.estimates language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved public.estimates%rowtype;
  line jsonb;
  included text[];
  excluded text[];
  price bigint := 0;
  position integer := 0;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if jsonb_typeof(p_input) is distinct from 'object'
    or jsonb_typeof(p_input->'lines') is distinct from 'array'
    or jsonb_typeof(p_input->'inclusions') is distinct from 'array'
    or jsonb_typeof(p_input->'exclusions') is distinct from 'array'
    or jsonb_typeof(p_input->'terms') is distinct from 'string' then
    raise exception 'Invalid draft' using errcode='22023';
  end if;
  if jsonb_array_length(p_input->'lines') not between 1 and 20
    or jsonb_array_length(p_input->'inclusions') not between 1 and 20
    or jsonb_array_length(p_input->'exclusions') not between 1 and 20
    or char_length(trim(p_input->>'terms')) not between 1 and 2000 then
    raise exception 'Invalid scope or terms' using errcode='22023';
  end if;
  for line in select value from jsonb_array_elements(p_input->'lines') loop
    if jsonb_typeof(line) is distinct from 'object'
      or jsonb_typeof(line->'label') is distinct from 'string'
      or char_length(trim(line->>'label')) not between 1 and 150
      or jsonb_typeof(line->'amountCents') is distinct from 'number'
      or not ((line->>'amountCents') ~ '^[0-9]{1,9}$') then
      raise exception 'Invalid pricing line' using errcode='22023';
    end if;
    price := price + (line->>'amountCents')::bigint;
  end loop;
  if price not between 1 and 999999999 then raise exception 'Invalid total' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements((p_input->'inclusions')||(p_input->'exclusions')) x
    where jsonb_typeof(x) is distinct from 'string' or char_length(trim(x #>> '{}')) not between 1 and 500) then
    raise exception 'Invalid scope item' using errcode='22023';
  end if;
  select array_agg(trim(value)) into included from jsonb_array_elements_text(p_input->'inclusions');
  select array_agg(trim(value)) into excluded from jsonb_array_elements_text(p_input->'exclusions');
  -- The parent lock serializes duplicate creation; the estimate lock matches publication.
  perform 1 from public.move_requests where id=p_request_id for update;
  if not found then raise exception 'Request unavailable' using errcode='22023'; end if;
  select * into saved from public.estimates where request_id=p_request_id for update;
  if found then
    if p_estimate_id is distinct from saved.id or p_revision is distinct from saved.revision or saved.status <> 'draft' then
      raise exception 'Draft changed or published; reopen it' using errcode='40001';
    end if;
    update public.estimates set inclusions=included, exclusions=excluded, terms=trim(p_input->>'terms'), revision=revision+1
      where id=saved.id returning * into saved;
    delete from public.estimate_items where estimate_id=saved.id;
  else
    if p_estimate_id is not null or p_revision is distinct from 0 then raise exception 'Draft unavailable' using errcode='40001'; end if;
    insert into public.estimates(request_id,created_by,inclusions,exclusions,terms)
      values(p_request_id,actor,included,excluded,trim(p_input->>'terms')) returning * into saved;
  end if;
  for line in select value from jsonb_array_elements(p_input->'lines') loop
    position := position+1;
    insert into public.estimate_items(estimate_id,position,label,amount_cents)
      values(saved.id,position,trim(line->>'label'),(line->>'amountCents')::integer);
  end loop;
  select * into saved from public.estimates where id=saved.id;
  return saved;
end $$;
revoke all on function rebel_move_private.save_estimate_draft(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function rebel_move_private.save_estimate_draft(uuid,uuid,integer,jsonb) to authenticated;
create function public.save_estimate_draft(p_request_id uuid,p_estimate_id uuid,p_revision integer,p_input jsonb)
returns public.estimates language sql security invoker set search_path='' as $$
  select rebel_move_private.save_estimate_draft(p_request_id,p_estimate_id,p_revision,p_input);
$$;
revoke all on function public.save_estimate_draft(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_estimate_draft(uuid,uuid,integer,jsonb) to authenticated;

create function rebel_move_private.publish_reviewed_estimate(p_estimate_id uuid,p_revision integer)
returns public.estimates language plpgsql security definer set search_path='' as $$
declare saved public.estimates%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Administrator required' using errcode='42501'; end if;
  select * into saved from public.estimates where id=p_estimate_id for update;
  if not found or saved.revision is distinct from p_revision or saved.status <> 'draft' then raise exception 'Draft changed or published; review again' using errcode='40001'; end if;
  return rebel_move_private.publish_estimate(p_estimate_id);
end $$;
revoke all on function rebel_move_private.publish_reviewed_estimate(uuid,integer) from public,anon,authenticated;
grant execute on function rebel_move_private.publish_reviewed_estimate(uuid,integer) to authenticated;
create function public.publish_reviewed_estimate(p_estimate_id uuid,p_revision integer)
returns public.estimates language sql security invoker set search_path='' as $$
  select rebel_move_private.publish_reviewed_estimate(p_estimate_id,p_revision);
$$;
revoke all on function public.publish_reviewed_estimate(uuid,integer) from public,anon,authenticated;
grant execute on function public.publish_reviewed_estimate(uuid,integer) to authenticated;
