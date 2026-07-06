-- El-fakturor: separat faktura per hyresgäst från en debiteringsomgång.
-- Sparar avläsningsdetaljer på debiteringen (för fakturaraderna) och tillåter typ='el'.

-- Detaljer som el-fakturans rader visar (Del, period, start/slut kWh).
alter table f_eldebitering add column if not exists start_varde        numeric;
alter table f_eldebitering add column if not exists slut_varde         numeric;
alter table f_eldebitering add column if not exists avlast_fran        date;
alter table f_eldebitering add column if not exists avlast_till        date;
alter table f_eldebitering add column if not exists matare_beskrivning text;
-- Koppling till skapad faktura (så vi inte dubbelfakturerar och kan visa fakturanr).
alter table f_eldebitering add column if not exists faktura_id text references f_faktura(id) on delete set null;

-- Tillåt typ='el' på fakturan (utöver faktura/kreditnota).
alter table f_faktura drop constraint if exists f_faktura_typ_check;
alter table f_faktura add constraint f_faktura_typ_check check (typ in ('faktura','kreditnota','el'));

-- El-fakturans rader behöver visa start/slut/period per mätare i utskriften.
-- Nullbara — används bara för el-rader; hyresrader lämnar dem tomma.
alter table f_fakturarad add column if not exists start_varde numeric;
alter table f_fakturarad add column if not exists slut_varde  numeric;
alter table f_fakturarad add column if not exists avlast_fran date;
alter table f_fakturarad add column if not exists avlast_till date;
