-- Engångsstädning: nollställ el-debiteringar som står som 'fakturerad' men vars
-- faktura tagits bort (uppstod innan radering nollställde debiteringen). Idempotent
-- — säker att köra flera gånger.
update f_eldebitering
set status = 'ej_fakturerad', faktura_id = null, fakturerad_datum = null
where status = 'fakturerad'
  and (faktura_id is null or faktura_id not in (select id from f_faktura));
