-- ============================================================================
-- 021_f_enum_constraints.sql
-- Återställer enum-CHECK-constraints på f_-tabellerna.
--
-- Bakgrund: de inline CHECK-constraints som fanns i 016_fastigheter_schema.sql
-- droppades vid dataimporten eftersom de var för snäva och avvisade faktiska
-- värden i käll-datan (hofmanns-fastigheter/prisma/dev.db).
--
-- Denna migration lägger tillbaka dem med UNIONEN av:
--   (schemats avsedda värdemängd)  +  (faktiska distinkta värden i datan)
-- så att inget befintligt data avvisas, men framtida skräp stoppas.
--
-- Utökningar utöver schemat (värden som fanns i datan men INTE i 016-schemat):
--   * f_hyresavtal.el_abonnemang     : + 'vidarefakturering'
--   * f_hyresavtal.va_abonnemang     : + 'vidarefakturering'
--   * f_hyresavtal.varme_abonnemang  : + 'vidarefakturering', + 'schablon'
--
-- Alla constraints använder NOT VALID-mönstret inte; kolumnerna är samtliga
-- NOT NULL i schemat, så ingen explicit NULL-hantering behövs.
--
-- KÖR DENNA FIL I SUPABASE (SQL Editor eller via migrations).
-- ============================================================================

-- 5. f_lokal
alter table f_lokal
  add constraint f_lokal_status_check
  check (status in ('ledig','uthyrd'));

-- 6. f_hyresgast
alter table f_hyresgast
  add constraint f_hyresgast_fakturaleverans_check
  check (fakturaleverans in ('epost','brev','efaktura'));

-- 8. f_hyresavtal
alter table f_hyresavtal
  add constraint f_hyresavtal_status_check
  check (status in ('utkast','aktiv','uppsagd','avslutad'));

alter table f_hyresavtal
  add constraint f_hyresavtal_hyrestid_check
  check (hyrestid in ('tillsvidare','tidsbegransat','forlangning'));

alter table f_hyresavtal
  add constraint f_hyresavtal_faktureringsfrekvens_check
  check (faktureringsfrekvens in ('månadsvis','kvartalsvis'));

alter table f_hyresavtal
  add constraint f_hyresavtal_forfallotyp_check
  check (forfallotyp in ('fore_period','dagar_efter'));

-- el_abonnemang: schema (hyresgast,hyresvard,ingar) + data ('vidarefakturering')
alter table f_hyresavtal
  add constraint f_hyresavtal_el_abonnemang_check
  check (el_abonnemang in ('hyresgast','hyresvard','ingar','vidarefakturering'));

-- va_abonnemang: schema (hyresgast,hyresvard,ingar) + data ('vidarefakturering')
alter table f_hyresavtal
  add constraint f_hyresavtal_va_abonnemang_check
  check (va_abonnemang in ('hyresgast','hyresvard','ingar','vidarefakturering'));

-- varme_abonnemang: schema (hyresgast,hyresvard,ingar) + data ('vidarefakturering','schablon')
alter table f_hyresavtal
  add constraint f_hyresavtal_varme_abonnemang_check
  check (varme_abonnemang in ('hyresgast','hyresvard','ingar','vidarefakturering','schablon'));

alter table f_hyresavtal
  add constraint f_hyresavtal_ventilation_check
  check (ventilation in ('hyresgast','hyresvard','ingar'));

alter table f_hyresavtal
  add constraint f_hyresavtal_underhallsansvar_check
  check (underhallsansvar in ('hyresvard','hyresgast_ytskikt','hyresgast_allt'));

-- 10. f_avtalsdokument
alter table f_avtalsdokument
  add constraint f_avtalsdokument_typ_check
  check (typ in ('hyresavtal','ritning','bild','ovrigt'));

-- 13. f_driftskostnad
alter table f_driftskostnad
  add constraint f_driftskostnad_typ_check
  check (typ in ('el','värme','vatten','sopor','försäkring','övrigt'));

alter table f_driftskostnad
  add constraint f_driftskostnad_period_check
  check (period in ('månad','år'));

-- 14. f_faktura
alter table f_faktura
  add constraint f_faktura_status_check
  check (status in ('ej_skickad','skickad','betald'));

-- 16. f_underhallsarende
alter table f_underhallsarende
  add constraint f_underhallsarende_typ_check
  check (typ in ('oljeavskiljare','hiss','port','brandlarm','sprinkler','ovk','elrevision','ovrigt'));

alter table f_underhallsarende
  add constraint f_underhallsarende_status_check
  check (status in ('planerad','forsenad','utford'));

-- 19. f_meddelande
alter table f_meddelande
  add constraint f_meddelande_typ_check
  check (typ in ('epost','internt'));

alter table f_meddelande
  add constraint f_meddelande_status_check
  check (status in ('utkast','skickat','misslyckat'));

-- 20. f_meddelande_mottagare
alter table f_meddelande_mottagare
  add constraint f_meddelande_mottagare_status_check
  check (status in ('skickat','levererat','misslyckat'));

-- 23. f_el_leverantorsfaktura
alter table f_el_leverantorsfaktura
  add constraint f_el_leverantorsfaktura_status_check
  check (status in ('ej_fakturerad','fakturerad'));

-- 24. f_eldebitering
alter table f_eldebitering
  add constraint f_eldebitering_status_check
  check (status in ('ej_fakturerad','fakturerad'));

-- 25. f_lan
alter table f_lan
  add constraint f_lan_amort_typ_check
  check (amort_typ in ('manadlig','kvartalsvis','arsvis','ingen'));
