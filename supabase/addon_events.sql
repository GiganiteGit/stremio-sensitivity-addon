-- Usage analytics for the Sensitivity Notes addon (one row per request of
-- interest). Lives in FindMyLegacy's Supabase project but is fully isolated:
-- the addon connects with the ANON key, so RLS below grants INSERT on THIS
-- TABLE ONLY and no read -- aggregation is done as service_role from the SQL
-- editor. No raw IPs are stored; ip_hash is a salted, truncated sha256.

create table if not exists public.addon_events (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  kind       text        not null,   -- manifest | stream | catalog | meta | configure | install
  ip_hash    text,                   -- sha256(salt + ip), 32 hex chars; null if ip unknown
  has_config boolean     not null default false
);

create index if not exists addon_events_ts_idx   on public.addon_events (ts);
create index if not exists addon_events_kind_ts_idx on public.addon_events (kind, ts);

alter table public.addon_events enable row level security;

-- The addon (anon key) may only INSERT events here; it can never read them.
drop policy if exists addon_events_insert on public.addon_events;
create policy addon_events_insert on public.addon_events
  for insert to anon, authenticated with check (true);

-- Explicit privileges (required for new tables). Anon gets INSERT only.
grant insert on table public.addon_events to anon, authenticated;
grant all    on table public.addon_events to service_role;
