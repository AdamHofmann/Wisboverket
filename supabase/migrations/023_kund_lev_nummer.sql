-- Kundnummer + leverantörsnummer som systemet sätter automatiskt.
-- Löpnummer via sekvenser (start 1001), backfill i created_at-ordning, sedan default.

-- ── Kunder ──────────────────────────────────────────────────────────────
create sequence if not exists customers_kundnummer_seq start with 1001;
alter table customers add column if not exists kundnummer integer;

do $$
declare r record;
begin
  for r in select id from customers where kundnummer is null order by created_at loop
    update customers set kundnummer = nextval('customers_kundnummer_seq') where id = r.id;
  end loop;
end $$;

alter table customers alter column kundnummer set default nextval('customers_kundnummer_seq');
create unique index if not exists customers_kundnummer_key on customers (kundnummer);

-- ── Leverantörer ────────────────────────────────────────────────────────
-- updated_at krävs av den befintliga triggern update_updated_at_column (fanns ej i 001)
alter table suppliers add column if not exists updated_at timestamptz not null default now();
-- Säkerställ kolumner som används av lev-kortet / AI-fakturaläsning
alter table suppliers add column if not exists orgnummer text;
alter table suppliers add column if not exists kategori text;

create sequence if not exists suppliers_leverantorsnummer_seq start with 1001;
alter table suppliers add column if not exists leverantorsnummer integer;

do $$
declare r record;
begin
  for r in select id from suppliers where leverantorsnummer is null order by created_at loop
    update suppliers set leverantorsnummer = nextval('suppliers_leverantorsnummer_seq') where id = r.id;
  end loop;
end $$;

alter table suppliers alter column leverantorsnummer set default nextval('suppliers_leverantorsnummer_seq');
create unique index if not exists suppliers_leverantorsnummer_key on suppliers (leverantorsnummer);
