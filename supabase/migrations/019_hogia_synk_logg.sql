-- 019_hogia_synk_logg.sql -- Sync log for the Hogia OpenBusiness integration.
-- Fas 2 sync writes one row per attempt (kund/artikel/faktura) for troubleshooting.

create table if not exists hogia_synk_logg (
  id            uuid primary key default gen_random_uuid(),
  tidpunkt      timestamptz not null default now(),
  entitet       text not null,                 -- 'kund' | 'artikel' | 'faktura'
  entitet_id    text,
  entitet_namn  text,
  riktning      text not null default 'push',
  status        text not null,                 -- 'ok' | 'fel'
  meddelande    text,
  detalj        jsonb,
  hogia_id      text
);

create index if not exists idx_hogia_synk_logg_tidpunkt on hogia_synk_logg (tidpunkt desc);
create index if not exists idx_hogia_synk_logg_status on hogia_synk_logg (status);

alter table hogia_synk_logg enable row level security;
drop policy if exists hogia_synk_logg_read on hogia_synk_logg;
drop policy if exists hogia_synk_logg_write on hogia_synk_logg;
create policy hogia_synk_logg_read on hogia_synk_logg for select using (auth.role() = 'authenticated');
create policy hogia_synk_logg_write on hogia_synk_logg for insert with check (auth.role() = 'authenticated');
