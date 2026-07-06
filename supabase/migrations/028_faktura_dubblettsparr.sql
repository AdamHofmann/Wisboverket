-- Hyresfaktura: kreditnota-stöd + hård dubbelfaktureringsspärr.
-- (Ersätter den tidigare enklare 028 — kör denna; idempotent.)

-- 1) Kreditnota-fält
alter table f_faktura add column if not exists typ text not null default 'faktura';
alter table f_faktura add column if not exists original_faktura_id text references f_faktura(id) on delete set null;

alter table f_faktura drop constraint if exists f_faktura_typ_check;
alter table f_faktura add constraint f_faktura_typ_check check (typ in ('faktura','kreditnota'));

-- 2) Tillåt 'krediterad' som status på en originalfaktura som krediterats
alter table f_faktura drop constraint if exists f_faktura_status_check;
alter table f_faktura add constraint f_faktura_status_check
  check (status in ('ej_skickad','skickad','betald','krediterad'));

-- 3) Dubbelfaktureringsspärr: max EN riktig faktura per hyresavtal + period.
--    Partiellt (typ='faktura') så att en kreditnota — som delar original-fakturans
--    hyresavtal + period — inte blockeras. Kompletterar app-sidans mjuka kontroll.
--    OBS: om det redan finns dubbletter failar index-skapandet; rensa då först:
--      select hyresavtal_id, period, count(*) from f_faktura where typ='faktura'
--      group by 1,2 having count(*) > 1;
drop index if exists f_faktura_avtal_period_key;
create unique index if not exists f_faktura_avtal_period_key
  on f_faktura (hyresavtal_id, period) where typ = 'faktura';
