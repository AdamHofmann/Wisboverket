-- Artiklar / debiteringskoder
create table if not exists artiklar (
  id uuid primary key default uuid_generate_v4(),
  artikelnummer text,
  namn text not null,
  beskrivning text,
  enhet text not null default 'st', -- tim, dag, st, kr, m2
  a_pris numeric(10,2) not null default 0,
  kostnad_per_enhet numeric(10,2) default 0,
  kategori text, -- bemanning, fordon, material, restid, tillagg
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);
alter table artiklar enable row level security;
create policy "auth_policy" on artiklar for all using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

-- Startartiklar
insert into artiklar (artikelnummer, namn, enhet, a_pris, kostnad_per_enhet, kategori) values
  ('A001', 'Bemanning', 'tim', 850, 450, 'bemanning'),
  ('A002', 'Servicebil', 'dag', 650, 350, 'fordon'),
  ('A003', 'Verktyg & utrustning', 'dag', 250, 100, 'material'),
  ('A004', 'Material pålägg', 'kr', 1, 0.8, 'material'),
  ('A005', 'Restid', 'tim', 425, 225, 'restid'),
  ('A006', 'Jourtillägg', 'tim', 300, 150, 'tillagg'),
  ('A007', 'Snöröjning', 'tim', 750, 400, 'bemanning'),
  ('A008', 'Städning', 'tim', 450, 300, 'bemanning')
on conflict do nothing;

-- Tidsrader per order
create table if not exists order_tid_rader (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders on delete cascade,
  resurs text, -- personalnamn
  artikel_id uuid references artiklar,
  artikel_namn text,
  enhet text not null default 'tim',
  antal numeric(10,2) not null default 0,
  a_pris numeric(10,2) not null default 0,
  kostnad_per_enhet numeric(10,2) default 0,
  total_intakt numeric(10,2) generated always as (antal * a_pris) stored,
  total_kostnad numeric(10,2) generated always as (antal * kostnad_per_enhet) stored,
  datum date,
  start_tid time,
  slut_tid time,
  anteckning text,
  created_at timestamptz not null default now()
);
alter table order_tid_rader enable row level security;
create policy "auth_policy" on order_tid_rader for all using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create index on order_tid_rader (order_id);

-- Inköp per order
create table if not exists order_inkop (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders on delete cascade,
  beskrivning text not null,
  leverantor text,
  belopp numeric(10,2) not null default 0,
  datum date,
  kategori text default 'material', -- material, verktyg, konsumtion, transport, ovrigt
  created_at timestamptz not null default now()
);
alter table order_inkop enable row level security;
create policy "auth_policy" on order_inkop for all using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create index on order_inkop (order_id);

-- Fakturor
create table if not exists fakturor (
  id uuid primary key default uuid_generate_v4(),
  fakturanummer text unique,
  order_id uuid references orders on delete set null,
  customer_id uuid references customers on delete set null,
  typ text not null default 'faktura', -- faktura | kreditnota
  status text not null default 'utkast', -- utkast | skickad | betald | krediterad | delkrediterad
  fakturadatum date not null default current_date,
  forfallodatum date,
  rader jsonb not null default '[]',
  moms_pct numeric(5,2) not null default 25,
  subtotal numeric(12,2) not null default 0,
  moms_belopp numeric(12,2) not null default 0,
  totalt numeric(12,2) not null default 0,
  kund_namn text,
  kund_orgnr text,
  kund_epost text,
  kund_adress text,
  referens text,
  original_faktura_id uuid references fakturor on delete set null, -- för kreditnotor
  hogia_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table fakturor enable row level security;
create policy "auth_policy" on fakturor for all using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create index on fakturor (order_id);

-- Nästa fakturanummer-sekvens
create sequence if not exists faktura_seq start 1001;

-- Uppdatera orders med faktureringsfält
alter table orders
  add column if not exists fakturerat boolean not null default false,
  add column if not exists fakturerat_belopp numeric(12,2),
  add column if not exists fakturadatum date,
  add column if not exists fakturareferens text,
  add column if not exists prioritet text default 'normal', -- lag | normal | hog
  add column if not exists bokad_start time,
  add column if not exists bokad_slut time;
