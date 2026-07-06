-- 022_order_faktura_las.sql
-- Ekonomiskt las for ordrar: markera fakturerade tidposter samt "faktureras inte".

-- Tidposter kan markeras som fakturerade (visas lasta i UI nar en faktura skapats).
alter table order_tid_rader add column if not exists fakturerad boolean not null default false;

-- En order kan stangas utan fakturering (blir da last och forsvinner ur "Att fakturera").
alter table orders add column if not exists faktureras_inte boolean not null default false;
