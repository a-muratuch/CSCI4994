begin;
-- Existing SELECT/RLS permissions remain authoritative. No new table grants.
do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
  alter publication supabase_realtime add table public.messages;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='jobs') then
  alter publication supabase_realtime add table public.jobs;
 end if;
end $$;
commit;
