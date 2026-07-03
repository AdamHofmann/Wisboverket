-- ============================================================================
-- 015_fastigheter_full.sql
-- Fastigheter-modulen: full port av hofmanns-fastigheter (26 Prisma-modeller)
-- till Supabase/Postgres.
--
-- KÖR DENNA FIL I SUPABASE (SQL Editor eller via migrations).
-- Lägg den som: supabase/migrations/015_fastigheter_full.sql
--
-- DESIGNBESLUT (se PLAN.md för motivering):
--  * SVENSKA tabellnamn med prefix "f_" för att INTE krocka med det redan
--    befintliga (men ofullständiga) engelska schemat i 001_initial_schema.sql
--    (companies/properties/units/leases/tenants/maintenance/...). Prefixet gör
--    att modulen kan samexistera; PLAN.md beskriver hur/om 001-tabellerna
--    fasas ut.
--  * PK = text med cuid-liknande default. Käll-datan är cuid-strängar; om du
--    migrerar befintlig data behåll text-PK. gen_random_uuid()::text ger nya
--    unika värden för nyskapade rader (kollisionsfritt mot cuid).
--  * Enum-lika fält = text + CHECK (flexibelt, matchar käll-appens "fria
--    String med kommenterade värden"-mönster).
--  * Belopp/hyror = numeric(14,2). Räntor/procent/index = numeric.
--  * updatedAt hanteras via trigger update_updated_at_column() (finns redan i
--    mål-appens migrationer, definierad i 008_uthyrning.sql).
--  * RLS: samma mönster som mål-appen — authenticated får allt. (Anon-policy
--    utelämnad avsiktligt; fastighetsdata är internt. Lägg till anon select
--    per tabell om publik läsning behövs, jfr hyresobjekt i 008.)
--  * onDelete satt explicit enligt käll-schemats Prisma-semantik.
-- ============================================================================

-- Säkerställ helpers (idempotent — finns troligen redan i mål-appen)
create extension if not exists pgcrypto;

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Bekväm default för text-cuid-kompatibel PK
-- (använder gen_random_uuid()::text så nya rader inte krockar med importerade cuid)

-- ============================================================================
-- 1. f_bolag  — fastighetsägande bolag / fakturaavsändare
-- ============================================================================
create table if not exists f_bolag (
  id                       text primary key default gen_random_uuid()::text,
  namn                     text not null,
  orgnummer                text,
  adress                   text,
  postnummer               text,
  stad                     text,
  epost                    text,
  telefon                  text,
  logotyp                  text,               -- Supabase Storage-URL
  bankgiro                 text,
  plusgiro                 text,
  momsregistreringsnummer  text,
  hemsida                  text,
  faktura_prefix_text      text,
  betalningsvillkor        integer,
  drojsmalsranta           numeric,
  fastighetsskattesats     numeric not null default 0.5,
  created_at               timestamptz not null default now()
);

-- ============================================================================
-- 2. f_fastighet  — central entitet
-- ============================================================================
create table if not exists f_fastighet (
  id                    text primary key default gen_random_uuid()::text,
  namn                  text not null,
  adress                text not null,
  stad                  text not null,
  postnummer            text not null,
  bolag_id              text references f_bolag(id) on delete set null,
  fastighetsbeteckning  text,                  -- legacy default-beteckning
  taxeringsvarde        numeric,
  kommentar             text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_f_fastighet_bolag on f_fastighet(bolag_id);
create trigger trg_f_fastighet_updated_at before update on f_fastighet
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 3. f_fastighetsbeteckning  — flera beteckningar per fastighet
-- ============================================================================
create table if not exists f_fastighetsbeteckning (
  id             text primary key default gen_random_uuid()::text,
  fastighet_id   text not null references f_fastighet(id) on delete cascade,
  beteckning     text not null,
  taxeringsvarde numeric,
  created_at     timestamptz not null default now()
);
create index if not exists idx_f_beteckning_fastighet on f_fastighetsbeteckning(fastighet_id);

-- ============================================================================
-- 4. f_byggnad
-- ============================================================================
create table if not exists f_byggnad (
  id             text primary key default gen_random_uuid()::text,
  fastighet_id   text not null references f_fastighet(id) on delete cascade,
  beteckning_id  text references f_fastighetsbeteckning(id) on delete set null,
  namn           text not null,
  adress         text,
  byggnadsar     integer,
  ombyggnads_ar  integer,
  totalyta       numeric,
  uthyrbar_yta   numeric,
  energiklass    text,
  uppvarmning    text,
  hiss           boolean not null default false,
  oljeavskiljare boolean not null default false,
  sprinkler      boolean not null default false,
  laddstolpar    boolean not null default false,
  fiber          boolean not null default false,
  manuellaportar integer,
  elportar       integer,
  beskrivning    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_f_byggnad_fastighet on f_byggnad(fastighet_id);
create index if not exists idx_f_byggnad_beteckning on f_byggnad(beteckning_id);
create trigger trg_f_byggnad_updated_at before update on f_byggnad
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 5. f_lokal  — uthyrningsobjekt
-- ============================================================================
create table if not exists f_lokal (
  id            text primary key default gen_random_uuid()::text,
  namn          text not null,
  typ           text not null,   -- bostad | lokal | garage | mark | parkering | kontor | lager
  yta           numeric not null,
  vaning        integer,
  status        text not null default 'ledig' check (status in ('ledig','uthyrd')),
  bashyra       numeric,
  moms          numeric not null default 0,   -- 0 eller 25
  fastighet_id  text not null references f_fastighet(id) on delete cascade,
  beteckning_id text references f_fastighetsbeteckning(id) on delete set null,
  byggnad_id    text references f_byggnad(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_f_lokal_fastighet on f_lokal(fastighet_id);
create index if not exists idx_f_lokal_byggnad on f_lokal(byggnad_id);
create index if not exists idx_f_lokal_beteckning on f_lokal(beteckning_id);
create trigger trg_f_lokal_updated_at before update on f_lokal
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 6. f_hyresgast
-- ============================================================================
create table if not exists f_hyresgast (
  id              text primary key default gen_random_uuid()::text,
  namn            text not null,
  personnummer    text,
  epost           text,
  fakturamail     text,
  telefon         text,
  adress          text,
  samfakturering  boolean not null default false,
  fakturaleverans text not null default 'epost' check (fakturaleverans in ('epost','brev','efaktura')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_f_hyresgast_updated_at before update on f_hyresgast
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 7. f_kontaktperson  — kontaktperson hos hyresgäst
-- ============================================================================
create table if not exists f_kontaktperson (
  id           text primary key default gen_random_uuid()::text,
  hyresgast_id text not null references f_hyresgast(id) on delete cascade,
  namn         text not null,
  roll         text,
  telefon      text,
  epost        text,
  anteckning   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_f_kontaktperson_hyresgast on f_kontaktperson(hyresgast_id);

-- ============================================================================
-- 8. f_hyresavtal  — stor entitet (~40 fält)
--    OBS: hyresgast_id är RESTRICT i källan (obligatorisk relation, ingen onDelete).
-- ============================================================================
create table if not exists f_hyresavtal (
  id                    text primary key default gen_random_uuid()::text,
  avtalsnummer          text,
  hyresgast_id          text not null references f_hyresgast(id) on delete restrict,
  startdatum            timestamptz not null,
  slutdatum             timestamptz,
  bashyra               numeric(14,2) not null,
  arshyra               numeric(14,2),
  indexupprakning       numeric not null default 0,
  status                text not null default 'aktiv' check (status in ('utkast','aktiv','uppsagd','avslutad')),
  uppsagningstid        integer not null default 3,
  avtalsdatum           timestamptz,
  hyrestid              text not null default 'tillsvidare' check (hyrestid in ('tillsvidare','tidsbegransat','forlangning')),
  forlangning           integer,
  uppsagningstid_hg     integer,
  uppsagningstid_hv     integer,
  faktureringsfrekvens  text not null default 'månadsvis' check (faktureringsfrekvens in ('månadsvis','kvartalsvis')),
  forfallotyp           text not null default 'fore_period' check (forfallotyp in ('fore_period','dagar_efter')),
  forfallodagar         integer not null default 30,
  anvand_index          boolean not null default true,
  basindex_ar           integer,
  basindex_manad        text,
  basindex_varde        numeric,
  anvandning            text,
  el_abonnemang         text not null default 'hyresgast' check (el_abonnemang in ('hyresgast','hyresvard','ingar')),
  va_abonnemang         text not null default 'ingar' check (va_abonnemang in ('hyresgast','hyresvard','ingar')),
  varme_abonnemang      text not null default 'ingar' check (varme_abonnemang in ('hyresgast','hyresvard','ingar')),
  ventilation           text not null default 'ingar' check (ventilation in ('hyresgast','hyresvard','ingar')),
  kostnadsandel         numeric,
  underhallsansvar      text not null default 'hyresgast_ytskikt' check (underhallsansvar in ('hyresvard','hyresgast_ytskikt','hyresgast_allt')),
  sakerhet              text,
  specialvillkor        text,
  uppsagning_kommentar  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_f_hyresavtal_hyresgast on f_hyresavtal(hyresgast_id);
create index if not exists idx_f_hyresavtal_status on f_hyresavtal(status);
create trigger trg_f_hyresavtal_updated_at before update on f_hyresavtal
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 9. f_hyresavtal_lokal  — JUNCTION (n-n Hyresavtal <-> Lokal)
-- ============================================================================
create table if not exists f_hyresavtal_lokal (
  id            text primary key default gen_random_uuid()::text,
  hyresavtal_id text not null references f_hyresavtal(id) on delete cascade,
  lokal_id      text not null references f_lokal(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (hyresavtal_id, lokal_id)
);
create index if not exists idx_f_hyravtallokal_avtal on f_hyresavtal_lokal(hyresavtal_id);
create index if not exists idx_f_hyravtallokal_lokal on f_hyresavtal_lokal(lokal_id);

-- ============================================================================
-- 10. f_avtalsdokument  — filbilaga (sokvag = Supabase Storage-path)
-- ============================================================================
create table if not exists f_avtalsdokument (
  id            text primary key default gen_random_uuid()::text,
  hyresavtal_id text not null references f_hyresavtal(id) on delete cascade,
  namn          text not null,
  typ           text not null check (typ in ('hyresavtal','ritning','bild','ovrigt')),
  filnamn       text not null,
  filstorlek    integer not null,
  sokvag        text not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_f_avtalsdokument_avtal on f_avtalsdokument(hyresavtal_id);

-- ============================================================================
-- 11. f_avtalsrad  — extra debiteringsrad
-- ============================================================================
create table if not exists f_avtalsrad (
  id            text primary key default gen_random_uuid()::text,
  hyresavtal_id text not null references f_hyresavtal(id) on delete cascade,
  artikelkod    text not null,   -- FSKATT | LARM | FIBER | EL | PARK | TILLAGG (öppen lista)
  beskrivning   text not null,
  belopp        numeric(14,2) not null,
  arsbelopp     numeric(14,2),
  moms          numeric not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_f_avtalsrad_avtal on f_avtalsrad(hyresavtal_id);

-- ============================================================================
-- 12. f_indexhojning  — KPI-höjningslogg
-- ============================================================================
create table if not exists f_indexhojning (
  id             text primary key default gen_random_uuid()::text,
  hyresavtal_id  text not null references f_hyresavtal(id) on delete cascade,
  datum          timestamptz not null,
  kpi_gammal     numeric not null,
  kpi_ny         numeric not null,
  procent        numeric not null,
  bashyra_gammal numeric(14,2) not null,
  bashyra_ny     numeric(14,2) not null,
  skapad_av      text not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_f_indexhojning_avtal on f_indexhojning(hyresavtal_id);

-- ============================================================================
-- 13. f_driftskostnad
-- ============================================================================
create table if not exists f_driftskostnad (
  id           text primary key default gen_random_uuid()::text,
  typ          text not null check (typ in ('el','värme','vatten','sopor','försäkring','övrigt')),
  belopp       numeric(14,2) not null,
  period       text not null check (period in ('månad','år')),
  fastighet_id text not null references f_fastighet(id) on delete cascade,
  fakturadatum timestamptz not null,
  leverantor   text,
  kommentar    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_f_driftskostnad_fastighet on f_driftskostnad(fastighet_id);
create trigger trg_f_driftskostnad_updated_at before update on f_driftskostnad
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 14. f_faktura  — hyresfaktura (fakturanummer UNIQUE)
-- ============================================================================
create table if not exists f_faktura (
  id            text primary key default gen_random_uuid()::text,
  fakturanummer text not null unique,
  hyresavtal_id text not null references f_hyresavtal(id) on delete cascade,
  belopp        numeric(14,2) not null,
  period        text not null,   -- "YYYY-MM"
  forfallodag   timestamptz not null,
  status        text not null default 'ej_skickad' check (status in ('ej_skickad','skickad','betald')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_f_faktura_avtal on f_faktura(hyresavtal_id);
create trigger trg_f_faktura_updated_at before update on f_faktura
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 15. f_fakturarad
-- ============================================================================
create table if not exists f_fakturarad (
  id          text primary key default gen_random_uuid()::text,
  faktura_id  text not null references f_faktura(id) on delete cascade,
  artikelkod  text not null,
  beskrivning text not null,
  antal       numeric not null default 1,
  apris       numeric(14,2) not null,
  belopp      numeric(14,2) not null,
  moms        numeric not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_f_fakturarad_faktura on f_fakturarad(faktura_id);

-- ============================================================================
-- 16. f_underhallsarende  — besiktning/service
--     byggnad_id är löst fält i källan; här gjort till riktig FK (SetNull).
-- ============================================================================
create table if not exists f_underhallsarende (
  id                text primary key default gen_random_uuid()::text,
  fastighet_id      text not null references f_fastighet(id) on delete cascade,
  byggnad_id        text references f_byggnad(id) on delete set null,
  typ               text not null check (typ in ('oljeavskiljare','hiss','port','brandlarm','sprinkler','ovk','elrevision','ovrigt')),
  namn              text not null,
  beskrivning       text,
  intervall_manader integer not null,
  senast_utford     timestamptz,
  nasta_gang        timestamptz not null,
  status            text not null default 'planerad' check (status in ('planerad','forsenad','utford')),
  ansvarig          text,
  leverantor        text,
  kostnad           numeric(14,2),
  kommentar         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_f_underhall_fastighet on f_underhallsarende(fastighet_id);
create index if not exists idx_f_underhall_byggnad on f_underhallsarende(byggnad_id);
create trigger trg_f_underhall_updated_at before update on f_underhallsarende
  for each row execute function update_updated_at_column();

-- ============================================================================
-- 17. f_underhallslogg
-- ============================================================================
create table if not exists f_underhallslogg (
  id         text primary key default gen_random_uuid()::text,
  arende_id  text not null references f_underhallsarende(id) on delete cascade,
  datum      timestamptz not null,
  utford_av  text not null,
  kommentar  text,
  kostnad    numeric(14,2),
  created_at timestamptz not null default now()
);
create index if not exists idx_f_underhallslogg_arende on f_underhallslogg(arende_id);

-- ============================================================================
-- 18. f_underhallsdokument
-- ============================================================================
create table if not exists f_underhallsdokument (
  id         text primary key default gen_random_uuid()::text,
  arende_id  text not null references f_underhallsarende(id) on delete cascade,
  namn       text not null,
  filnamn    text not null,
  filstorlek integer not null,
  sokvag     text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_f_underhallsdok_arende on f_underhallsdokument(arende_id);

-- ============================================================================
-- 19. f_meddelande  — utskick
-- ============================================================================
create table if not exists f_meddelande (
  id         text primary key default gen_random_uuid()::text,
  amne       text not null,
  brodel     text not null,
  fran       text not null,
  typ        text not null default 'epost' check (typ in ('epost','internt')),
  status     text not null default 'skickat' check (status in ('utkast','skickat','misslyckat')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 20. f_meddelande_mottagare
--     hyresgast_id var löst fält; här riktig FK (SetNull).
-- ============================================================================
create table if not exists f_meddelande_mottagare (
  id            text primary key default gen_random_uuid()::text,
  meddelande_id text not null references f_meddelande(id) on delete cascade,
  hyresgast_id  text references f_hyresgast(id) on delete set null,
  namn          text not null,
  epost         text not null,
  status        text not null default 'skickat' check (status in ('skickat','levererat','misslyckat'))
);
create index if not exists idx_f_medmottagare_meddelande on f_meddelande_mottagare(meddelande_id);

-- ============================================================================
-- 21. f_elmatare
--     lokal_id/byggnad_id var lösa fält; här riktiga FK (SetNull).
-- ============================================================================
create table if not exists f_elmatare (
  id            text primary key default gen_random_uuid()::text,
  matarnummer   text not null,
  fastighet_id  text not null references f_fastighet(id) on delete cascade,
  lokal_id      text references f_lokal(id) on delete set null,
  byggnad_id    text references f_byggnad(id) on delete set null,
  beskrivning   text,
  schablon_kwh  numeric,
  aktiv         boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_f_elmatare_fastighet on f_elmatare(fastighet_id);

-- ============================================================================
-- 22. f_elavlasning
-- ============================================================================
create table if not exists f_elavlasning (
  id         text primary key default gen_random_uuid()::text,
  matare_id  text not null references f_elmatare(id) on delete cascade,
  datum      timestamptz not null,
  varde      numeric not null,   -- kWh mätarställning
  avlast_av  text,
  kommentar  text,
  created_at timestamptz not null default now()
);
create index if not exists idx_f_elavlasning_matare on f_elavlasning(matare_id);

-- ============================================================================
-- 23. f_el_leverantorsfaktura
-- ============================================================================
create table if not exists f_el_leverantorsfaktura (
  id            text primary key default gen_random_uuid()::text,
  fastighet_id  text not null references f_fastighet(id) on delete cascade,
  period_fran   timestamptz not null,
  period_till   timestamptz not null,
  total_kwh     numeric,
  total_belopp  numeric(14,2) not null,   -- exkl. moms
  pris_per_kwh  numeric,
  fakturanummer text,
  status        text not null default 'ej_fakturerad' check (status in ('ej_fakturerad','fakturerad')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_f_ellevfaktura_fastighet on f_el_leverantorsfaktura(fastighet_id);

-- ============================================================================
-- 24. f_eldebitering
--     matare_id/lokal_id var lösa fält; här riktiga FK (SetNull).
-- ============================================================================
create table if not exists f_eldebitering (
  id                text primary key default gen_random_uuid()::text,
  leverantor_id     text not null references f_el_leverantorsfaktura(id) on delete cascade,
  matare_id         text references f_elmatare(id) on delete set null,
  lokal_id          text references f_lokal(id) on delete set null,
  hyresgast_namn    text not null,
  forbrukning       numeric,
  pris_per_kwh      numeric not null,
  belopp            numeric(14,2) not null,   -- exkl. moms
  status            text not null default 'ej_fakturerad' check (status in ('ej_fakturerad','fakturerad')),
  fakturerad_datum  timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_f_eldebitering_leverantor on f_eldebitering(leverantor_id);

-- ============================================================================
-- 25. f_lan  — lån per fastighet
-- ============================================================================
create table if not exists f_lan (
  id           text primary key default gen_random_uuid()::text,
  fastighet_id text not null references f_fastighet(id) on delete cascade,
  langivare    text not null,
  belopp       numeric(14,2) not null,
  ranta        numeric not null,
  amort_typ    text not null default 'manadlig' check (amort_typ in ('manadlig','kvartalsvis','arsvis','ingen')),
  amort_belopp numeric(14,2),
  startdatum   timestamptz not null,
  slutdatum    timestamptz,
  kommentar    text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_f_lan_fastighet on f_lan(fastighet_id);

-- ============================================================================
-- 26. f_user  — NextAuth-user (VALFRI).
--     REKOMMENDATION: migrera INTE. Mål-appen använder Supabase Auth
--     (auth.users + profiles). Denna tabell finns bara för fullständighet.
--     Avkommentera endast om du verkligen behöver käll-appens User-rader.
-- ============================================================================
-- create table if not exists f_user (
--   id         text primary key default gen_random_uuid()::text,
--   name       text,
--   email      text not null unique,
--   password   text not null,   -- OBS: hasha! (klartext i källan)
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now()
-- );

-- ============================================================================
-- ROW LEVEL SECURITY  (samma mönster som mål-appen: authenticated får allt)
-- ============================================================================
alter table f_bolag                  enable row level security;
alter table f_fastighet              enable row level security;
alter table f_fastighetsbeteckning   enable row level security;
alter table f_byggnad                enable row level security;
alter table f_lokal                  enable row level security;
alter table f_hyresgast              enable row level security;
alter table f_kontaktperson          enable row level security;
alter table f_hyresavtal             enable row level security;
alter table f_hyresavtal_lokal       enable row level security;
alter table f_avtalsdokument         enable row level security;
alter table f_avtalsrad              enable row level security;
alter table f_indexhojning           enable row level security;
alter table f_driftskostnad          enable row level security;
alter table f_faktura                enable row level security;
alter table f_fakturarad             enable row level security;
alter table f_underhallsarende       enable row level security;
alter table f_underhallslogg         enable row level security;
alter table f_underhallsdokument     enable row level security;
alter table f_meddelande             enable row level security;
alter table f_meddelande_mottagare   enable row level security;
alter table f_elmatare               enable row level security;
alter table f_elavlasning            enable row level security;
alter table f_el_leverantorsfaktura  enable row level security;
alter table f_eldebitering           enable row level security;
alter table f_lan                    enable row level security;

-- Policies: inloggad (authenticated) användare kommer åt allt.
-- Mönstret följer mål-appens 008_uthyrning.sql ("(select auth.uid()) is not null").
do $$
declare t text;
begin
  foreach t in array array[
    'f_bolag','f_fastighet','f_fastighetsbeteckning','f_byggnad','f_lokal',
    'f_hyresgast','f_kontaktperson','f_hyresavtal','f_hyresavtal_lokal',
    'f_avtalsdokument','f_avtalsrad','f_indexhojning','f_driftskostnad',
    'f_faktura','f_fakturarad','f_underhallsarende','f_underhallslogg',
    'f_underhallsdokument','f_meddelande','f_meddelande_mottagare',
    'f_elmatare','f_elavlasning','f_el_leverantorsfaktura','f_eldebitering','f_lan'
  ]
  loop
    execute format(
      'create policy %I on %I for all using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);',
      'authenticated_all_' || t, t
    );
  end loop;
end $$;

-- ============================================================================
-- STORAGE (kör separat / via Supabase UI om buckets ej finns)
-- Krävs för: f_bolag.logotyp, f_avtalsdokument, f_underhallsdokument.
-- ============================================================================
-- insert into storage.buckets (id, name, public) values ('fastigheter','fastigheter', false)
--   on conflict (id) do nothing;
-- (Lägg RLS-policy på storage.objects för bucket 'fastigheter' enligt mål-appens 014_order_bilder_storage.sql-mönster.)
