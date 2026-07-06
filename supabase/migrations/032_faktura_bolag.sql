-- Avsändarbolag på fakturan. För hyresfakturor härleds bolaget via hyresavtal →
-- lokal → fastighet → bolag, men manuella fakturor saknar avtal. Vi lagrar därför
-- bolaget direkt på fakturan (härleds automatiskt från hyresgästens avtal, annars valbart).
alter table f_faktura add column if not exists bolag_id text references f_bolag(id) on delete set null;
create index if not exists idx_f_faktura_bolag on f_faktura(bolag_id);
