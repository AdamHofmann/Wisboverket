-- Mailsignatur per bolag (läggs sist i utgående kommunikations-meddelanden).
-- Redigeras i Inställningar → Bolag; väljs via avsändarbolag i komponeraren.
alter table f_bolag add column if not exists mailsignatur text;
