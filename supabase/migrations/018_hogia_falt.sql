-- 018_hogia_falt.sql — Fas 1: fält för Hogia OpenBusiness-synk (app-förberedelse)

-- KUND: leveranssätt (brev/epost/e-faktura Peppol) + Peppol-id + Hogia-koppling
alter table customers add column if not exists leveranssatt text not null default 'epost';
alter table customers add column if not exists peppol_id text;
alter table customers add column if not exists hogia_kund_id text;
alter table customers add column if not exists hogia_synkad_at timestamptz;
alter table customers drop constraint if exists customers_leveranssatt_check;
alter table customers add constraint customers_leveranssatt_check check (leveranssatt in ('brev', 'epost', 'peppol'));

-- ARTIKEL: intäktskonto (ur kontoplanen) + momssats + Hogia-koppling
alter table artiklar add column if not exists konto text;
alter table artiklar add column if not exists momssats int not null default 25;
alter table artiklar add column if not exists hogia_artikel_id text;
alter table artiklar add column if not exists hogia_synkad_at timestamptz;

-- FAKTURA: Hogia-koppling
alter table fakturor add column if not exists hogia_faktura_id text;
alter table fakturor add column if not exists hogia_synkad_at timestamptz;
