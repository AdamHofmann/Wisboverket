-- Uthyrningsmodul (hyresobjekt) — annonser för lediga lokaler/kontor/garage m.m.

create table if not exists hyresobjekt (
  id uuid primary key default gen_random_uuid(),

  -- Objekt
  intern_namn text,
  titel text,
  fastighet text,
  typer text[] not null default '{}',
  typ text,
  tillganglig_typ text not null default 'overenskommelse' check (tillganglig_typ in ('datum', 'overenskommelse')),
  tillganglig_fran date,
  publicerad boolean not null default false,

  -- Yta
  total_yta numeric,
  hyra numeric,
  kr_kvm_ar numeric,
  planlosning text,

  -- Media
  bilder text[] not null default '{}',

  -- Bekvämligheter
  bekvamligheter text[] not null default '{}',

  -- Text
  kort_beskrivning text,
  beskrivning text,

  -- Kontakt
  kontakt_namn text,
  kontakt_epost text,
  kontakt_telefon text,
  kontakt_titel text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hyresobjekt enable row level security;

create policy "Authenticated users can do everything on hyresobjekt"
  on hyresobjekt for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "Anon kan läsa publicerade hyresobjekt"
  on hyresobjekt for select
  to anon
  using (publicerad = true);

create or replace trigger trg_hyresobjekt_updated_at
before update on hyresobjekt
for each row execute function update_updated_at_column();

create index on hyresobjekt (publicerad);
