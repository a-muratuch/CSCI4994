-- LOCAL MIGRATION PROPOSAL ONLY: do not run against hosted Supabase without owner approval.
-- Requires the existing move_requests foundation. This is not a complete local baseline.
-- CLI migration registration and baseline reconciliation are deferred to Phase 3.
begin;

alter table public.move_requests
  add column reference_number bigint generated always as identity (start with 1001);
alter table public.move_requests
  add constraint move_requests_reference_number_key unique (reference_number);

comment on column public.move_requests.reference_number is
  'Server-generated display reference; render as RM-<number>. UUID remains the relationship and route key.';

-- Existing rows receive unique numbers; their numbering is not a chronological guarantee.
-- Identity sequences allow gaps and are never used for authorization or row ownership.
-- Existing RLS, column grants, RPCs and UUID relationships remain unchanged.
-- Review actual INSERT/UPDATE grants and test concurrent inserts locally before applying.
commit;
