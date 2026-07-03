-- Cache av företagsuppslag (Apiverket) så samma sökning inte kostar mot dagskvoten igen.
-- Innehåller endast offentlig företagsregisterdata → ofarligt att låta anon-nyckeln läsa/skriva
-- (API-routen körs server-side med anon-nyckeln).
create table if not exists lookup_cache (
  query text primary key,
  response jsonb not null,
  created_at timestamptz not null default now()
);

alter table lookup_cache enable row level security;

create policy "Alla kan läsa lookup_cache" on lookup_cache for select using (true);
create policy "Alla kan skriva lookup_cache" on lookup_cache for insert with check (true);
create policy "Alla kan uppdatera lookup_cache" on lookup_cache for update using (true) with check (true);
