-- Mål (goals) table
create table if not exists mal (
  id uuid primary key default gen_random_uuid(),
  namn text not null,
  typ text not null default 'omsattning' check (typ in ('omsattning','antal_ordrar','vinst','fritt')),
  ar int not null default extract(year from now()),
  mal_varde numeric not null default 0,
  manuellt_varde numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table mal enable row level security;

create policy "Authenticated users can do everything on mal"
  on mal for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create or replace trigger trg_mal_updated_at
before update on mal
for each row execute function update_updated_at_column();
