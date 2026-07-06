-- El-debitering: slå ihop nät + handel och debitera hyresgäster kvartalsvis via
-- "debiteringsomgångar" (grupp av leverantörsfakturor för en fastighet + period).

-- 1) Fakturatyp på leverantörsfakturan (nät/handel/övrigt) — styr vilken kWh som är "sann"
alter table f_el_leverantorsfaktura add column if not exists typ text; -- 'nat' | 'handel' | 'ovrigt'

-- 2) Debiteringsomgång
create table if not exists f_el_debiteringsomgang (
  id            text primary key default gen_random_uuid()::text,
  fastighet_id  text not null references f_fastighet(id) on delete cascade,
  period_fran   timestamptz not null,
  period_till   timestamptz not null,
  total_kwh     numeric,                          -- nätbolagets kWh (nämnaren i blandpriset)
  total_kostnad numeric(14,2) not null default 0, -- summan av alla inkluderade fakturor (nät + handel), exkl moms
  blandpris     numeric,                          -- total_kostnad / total_kwh
  status        text not null default 'utkast' check (status in ('utkast','debiterad','fakturerad')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_f_omgang_fastighet on f_el_debiteringsomgang(fastighet_id);

-- 3) Vilka leverantörsfakturor som ingår i en omgång
create table if not exists f_el_omgang_faktura (
  omgang_id  text not null references f_el_debiteringsomgang(id) on delete cascade,
  faktura_id text not null references f_el_leverantorsfaktura(id) on delete cascade,
  primary key (omgang_id, faktura_id)
);

-- 4) Hyresgästdebitering kan nu tillhöra en omgång (leverantor_id blir valfri)
alter table f_eldebitering add column if not exists omgang_id text references f_el_debiteringsomgang(id) on delete cascade;
alter table f_eldebitering alter column leverantor_id drop not null;

-- 5) RLS (samma mönster som övriga f_-tabeller)
alter table f_el_debiteringsomgang enable row level security;
alter table f_el_omgang_faktura enable row level security;

drop policy if exists f_omgang_all on f_el_debiteringsomgang;
create policy f_omgang_all on f_el_debiteringsomgang for all
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy if exists f_omgang_faktura_all on f_el_omgang_faktura;
create policy f_omgang_faktura_all on f_el_omgang_faktura for all
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
