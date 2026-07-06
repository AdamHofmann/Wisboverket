-- Manuell faktura: fakturera en hyresgäst för extra/engångskostnader (ej kopplat till
-- ett hyresavtal). hyresavtal_id blir valfri, och en direkt hyresgäst-koppling läggs till.
alter table f_faktura alter column hyresavtal_id drop not null;
alter table f_faktura add column if not exists hyresgast_id text references f_hyresgast(id) on delete set null;
