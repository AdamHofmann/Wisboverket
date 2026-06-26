-- ============================================================
-- WISBOVERKET — INITIAL SCHEMA
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- GEMENSAMT
-- ============================================================

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  namn text not null,
  epost text,
  roll text not null default 'användare', -- 'admin' | 'användare'
  modul_order boolean not null default true,
  modul_fastighet boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-skapa profil vid ny användare
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, namn, epost)
  values (new.id, coalesce(new.raw_user_meta_data->>'namn', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- ORDER-MODULEN
-- ============================================================

create table customers (
  id uuid primary key default uuid_generate_v4(),
  namn text not null,
  typ text not null default 'privat', -- 'privat' | 'företag'
  epost text,
  telefon text,
  adress text,
  postnummer text,
  ort text,
  orgnummer text,
  anteckningar text,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers on delete cascade,
  namn text not null,
  roll text,
  telefon text,
  epost text,
  created_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  namn text not null,
  typ text,
  telefon text,
  epost text,
  adress text,
  orgnummer text,
  anteckningar text,
  created_at timestamptz not null default now()
);

create table articles (
  id uuid primary key default uuid_generate_v4(),
  artikelnummer text,
  namn text not null,
  beskrivning text,
  pris numeric not null default 0,
  enhet text not null default 'st', -- 'st' | 'tim' | 'm²' | 'm³'
  moms_procent numeric not null default 25,
  bokforing_konto text, -- fylls i när kontoplan finns
  hogia_artikel_id text,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text unique,
  titel text not null,
  kategori text, -- 'Flytt' | 'Städ' | 'El' | 'Rör' | 'Bygg' | etc.
  status text not null default 'aktiv', -- 'aktiv' | 'slutförd' | 'inaktiv'
  customer_id uuid references customers on delete set null,
  fastighet text,
  postnummer text,
  ort text,
  bokad_datum date,
  bokad_start time,
  bokad_slut time,
  tilldelad text[], -- array av namn
  beskrivning text,
  intern_anteckning text,
  pris numeric,
  offert_id uuid, -- sätts när offert finns
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table offers (
  id uuid primary key default uuid_generate_v4(),
  offer_number text unique,
  customer_id uuid references customers on delete set null,
  order_id uuid references orders on delete set null,
  status text not null default 'utkast', -- 'utkast' | 'skickad' | 'accepterad' | 'nekad'
  fastighet text,
  giltig_till date,
  total_excl_moms numeric not null default 0,
  moms numeric not null default 0,
  total_incl_moms numeric not null default 0,
  anteckningar text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table offer_rows (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references offers on delete cascade,
  artikel_id uuid references articles on delete set null,
  beskrivning text not null,
  antal numeric not null default 1,
  apris numeric not null default 0,
  moms_procent numeric not null default 25,
  sort_order integer not null default 0
);

create table invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text unique,
  order_id uuid references orders on delete set null,
  customer_id uuid references customers on delete set null,
  status text not null default 'utkast', -- 'utkast' | 'skickad' | 'betald' | 'förfallen'
  forfallodatum date,
  betald_datum date,
  total_excl_moms numeric not null default 0,
  moms numeric not null default 0,
  total_incl_moms numeric not null default 0,
  hogia_faktura_id text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table invoice_rows (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references invoices on delete cascade,
  artikel_id uuid references articles on delete set null,
  beskrivning text not null,
  antal numeric not null default 1,
  apris numeric not null default 0,
  moms_procent numeric not null default 25,
  bokforing_konto text,
  sort_order integer not null default 0
);

create table staff_status (
  id uuid primary key default uuid_generate_v4(),
  person text not null,
  datum date not null,
  typ text not null, -- 'semester' | 'sjuk' | 'obokningsbar' | 'tidsblock'
  fran_tid time,
  till_tid time,
  created_at timestamptz not null default now(),
  unique(person, datum, typ, fran_tid)
);

create table templates (
  id uuid primary key default uuid_generate_v4(),
  namn text not null,
  typ text not null, -- 'sms' | 'offert' | 'faktura'
  innehall text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- FASTIGHETS-MODULEN
-- ============================================================

create table companies (
  id uuid primary key default uuid_generate_v4(),
  namn text not null,
  orgnummer text,
  adress text,
  postnummer text,
  ort text,
  epost text,
  telefon text,
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies on delete cascade,
  beteckning text, -- T.ex. Triangeln 1
  adress text not null,
  postnummer text,
  ort text,
  byggår integer,
  antal_enheter integer,
  anteckningar text,
  created_at timestamptz not null default now()
);

create table buildings (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties on delete cascade,
  namn text not null,
  byggår integer,
  created_at timestamptz not null default now()
);

create table units (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties on delete cascade,
  building_id uuid references buildings on delete set null,
  beteckning text not null,
  typ text, -- 'kontor' | 'butik' | 'lager' | 'bostad' | 'övrigt'
  yta_kvm numeric,
  plan integer,
  status text not null default 'ledig', -- 'uthyrd' | 'ledig' | 'underhåll'
  created_at timestamptz not null default now()
);

create table tenants (
  id uuid primary key default uuid_generate_v4(),
  namn text not null,
  typ text not null default 'företag', -- 'företag' | 'privat'
  orgnummer text,
  personnummer text,
  epost text,
  telefon text,
  adress text,
  kontaktperson text,
  created_at timestamptz not null default now()
);

create table leases (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references units on delete cascade,
  tenant_id uuid not null references tenants on delete cascade,
  startdatum date not null,
  slutdatum date, -- null = tillsvidare
  bashyra numeric not null default 0,
  indexklausul boolean not null default false,
  index_basår integer,
  uppsagningstid_manader integer not null default 3,
  driftskostnader_ansvar text, -- 'hyresvärd' | 'hyresgäst' | 'delat'
  anteckningar text,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);

create table lease_rows (
  id uuid primary key default uuid_generate_v4(),
  lease_id uuid not null references leases on delete cascade,
  beskrivning text not null,
  belopp numeric not null default 0,
  typ text, -- 'hyra' | 'tillägg' | 'rabatt'
  sort_order integer not null default 0
);

create table index_adjustments (
  id uuid primary key default uuid_generate_v4(),
  lease_id uuid not null references leases on delete cascade,
  datum date not null,
  gammalt_index numeric,
  nytt_index numeric,
  procent_forändring numeric,
  nytt_belopp numeric,
  created_at timestamptz not null default now()
);

create table operating_costs (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties on delete cascade,
  kategori text not null, -- 'el' | 'vatten' | 'värme' | 'försäkring' | 'övrigt'
  beskrivning text,
  belopp numeric not null default 0,
  datum date not null,
  created_at timestamptz not null default now()
);

create table maintenance (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties on delete cascade,
  unit_id uuid references units on delete set null,
  titel text not null,
  beskrivning text,
  status text not null default 'öppen', -- 'öppen' | 'pågående' | 'stängd'
  prioritet text not null default 'normal', -- 'låg' | 'normal' | 'hög' | 'akut'
  rapporterad_av text,
  assignad_till text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table maintenance_log (
  id uuid primary key default uuid_generate_v4(),
  maintenance_id uuid not null references maintenance on delete cascade,
  anteckning text not null,
  skapad_av text,
  created_at timestamptz not null default now()
);

create table electricity_meters (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties on delete cascade,
  unit_id uuid references units on delete set null,
  matarnummer text not null,
  placering text,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);

create table electricity_readings (
  id uuid primary key default uuid_generate_v4(),
  meter_id uuid not null references electricity_meters on delete cascade,
  avlasningsdatum date not null,
  varde numeric not null,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties on delete cascade,
  tenant_id uuid references tenants on delete set null,
  subject text,
  body text not null,
  skapad_av uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Aktivera RLS på alla tabeller
alter table profiles enable row level security;
alter table customers enable row level security;
alter table contacts enable row level security;
alter table suppliers enable row level security;
alter table articles enable row level security;
alter table orders enable row level security;
alter table offers enable row level security;
alter table offer_rows enable row level security;
alter table invoices enable row level security;
alter table invoice_rows enable row level security;
alter table staff_status enable row level security;
alter table templates enable row level security;
alter table companies enable row level security;
alter table properties enable row level security;
alter table buildings enable row level security;
alter table units enable row level security;
alter table tenants enable row level security;
alter table leases enable row level security;
alter table lease_rows enable row level security;
alter table index_adjustments enable row level security;
alter table operating_costs enable row level security;
alter table maintenance enable row level security;
alter table maintenance_log enable row level security;
alter table electricity_meters enable row level security;
alter table electricity_readings enable row level security;
alter table messages enable row level security;

-- Policies: inloggad användare kommer åt allt (tills vi sätter upp roller)
create policy "Autentiserade användare kan läsa och skriva" on profiles for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on customers for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on contacts for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on suppliers for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on articles for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on orders for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on offers for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on offer_rows for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on invoices for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on invoice_rows for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on staff_status for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on templates for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on companies for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on properties for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on buildings for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on units for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on tenants for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on leases for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on lease_rows for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on index_adjustments for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on operating_costs for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on maintenance for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on maintenance_log for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on electricity_meters for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on electricity_readings for all using (auth.role() = 'authenticated');
create policy "Autentiserade användare kan läsa och skriva" on messages for all using (auth.role() = 'authenticated');

-- ============================================================
-- INDEXES för prestanda
-- ============================================================

create index on orders (customer_id);
create index on orders (status);
create index on orders (bokad_datum);
create index on offers (customer_id);
create index on invoices (customer_id);
create index on invoices (status);
create index on invoices (hogia_faktura_id);
create index on contacts (customer_id);
create index on offer_rows (offer_id);
create index on invoice_rows (invoice_id);
create index on staff_status (person, datum);
create index on properties (company_id);
create index on units (property_id);
create index on leases (unit_id);
create index on leases (tenant_id);
create index on leases (aktiv);
create index on maintenance (property_id, status);
create index on electricity_readings (meter_id);
