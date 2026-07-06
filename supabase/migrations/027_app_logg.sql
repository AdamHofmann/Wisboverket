-- Inbyggd systemlogg för app-hälsa: fel + prestanda. Egen tabell + admin-vy
-- (samma mönster som Hogia-synkloggen). Ingen data lämnar Supabase.

create table if not exists app_logg (
  id          uuid primary key default gen_random_uuid(),
  typ         text not null default 'info' check (typ in ('fel','prestanda','info')),
  niva        text not null default 'info' check (niva in ('error','warn','info')),
  kalla       text,          -- 'klient' | 'server' | route-/komponentnamn
  path        text,          -- sida eller API-route
  meddelande  text not null,
  duration_ms numeric,       -- för prestanda-poster (svarstid / sidladdning)
  detaljer    jsonb,         -- stack, metrik, extra kontext
  created_at  timestamptz not null default now()
);

create index if not exists idx_app_logg_created on app_logg (created_at desc);
create index if not exists idx_app_logg_typ on app_logg (typ);

alter table app_logg enable row level security;

drop policy if exists app_logg_read on app_logg;
create policy app_logg_read on app_logg for select
  using ((select auth.uid()) is not null);

drop policy if exists app_logg_write on app_logg;
create policy app_logg_write on app_logg for insert
  with check ((select auth.uid()) is not null);
