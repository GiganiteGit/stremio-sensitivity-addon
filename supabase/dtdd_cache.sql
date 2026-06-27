-- Phase 4 durable response cache for the Sensitivity Notes addon.
-- One row per resolved IMDb id; payload is the minimal trigger result the
-- stream handler renders.
--
-- This lives in FindMyLegacy's Supabase project but is fully isolated: the addon
-- connects with the ANON key (never the prod service_role key on the public addon
-- host), so RLS policies below grant CRUD on THIS TABLE ONLY. Every other table
-- keeps its own owner-scoped RLS. The cached data is non-sensitive public DTDD
-- info, so world-writable on this one table is an acceptable trade.

create table if not exists public.dtdd_cache (
  imdb_id    text primary key,
  payload    jsonb       not null,
  fetched_at timestamptz not null default now()
);

-- Helps any future "delete rows older than N days" housekeeping.
create index if not exists dtdd_cache_fetched_at_idx
  on public.dtdd_cache (fetched_at);

alter table public.dtdd_cache enable row level security;

-- Anon (the addon) may read and upsert cache rows on this table only.
drop policy if exists dtdd_cache_read on public.dtdd_cache;
create policy dtdd_cache_read on public.dtdd_cache
  for select to anon, authenticated using (true);

drop policy if exists dtdd_cache_insert on public.dtdd_cache;
create policy dtdd_cache_insert on public.dtdd_cache
  for insert to anon, authenticated with check (true);

drop policy if exists dtdd_cache_update on public.dtdd_cache;
create policy dtdd_cache_update on public.dtdd_cache
  for update to anon, authenticated using (true) with check (true);

-- Explicit privileges (required for new tables; delete intentionally withheld).
grant select, insert, update on table public.dtdd_cache to anon, authenticated;
grant all on table public.dtdd_cache to service_role;
