-- Offers table
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  offer_number text,
  titel text,
  status text not null default 'utkast' check (status in ('utkast','skickad','accepterad','avvisad')),
  customer_id uuid references customers(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  beskrivning text,
  giltig_till date,
  rader jsonb not null default '[]',
  subtotal numeric not null default 0,
  moms_belopp numeric not null default 0,
  totalt numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-number offers
create or replace function set_offer_number()
returns trigger language plpgsql as $$
declare
  next_num int;
begin
  select coalesce(max(cast(substring(offer_number from 5) as int)), 1000) + 1
  into next_num
  from offers
  where offer_number like 'OFF-%';
  new.offer_number := 'OFF-' || next_num;
  return new;
end;
$$;

create or replace trigger trg_offer_number
before insert on offers
for each row when (new.offer_number is null)
execute function set_offer_number();

-- Suppliers table
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  namn text not null,
  telefon text,
  epost text,
  adress text,
  kategori text,
  anteckningar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table offers enable row level security;
alter table suppliers enable row level security;

create policy "Authenticated users can do everything on offers"
  on offers for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create policy "Authenticated users can do everything on suppliers"
  on suppliers for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- Updated at triggers
create or replace trigger trg_offers_updated_at
before update on offers
for each row execute function update_updated_at_column();

create or replace trigger trg_suppliers_updated_at
before update on suppliers
for each row execute function update_updated_at_column();
