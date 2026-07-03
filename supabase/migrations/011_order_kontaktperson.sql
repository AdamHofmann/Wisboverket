-- Kontaktperson direkt på ordern (separat från betalande kund och från besöksmottagare)
alter table orders
  add column if not exists kontakt_namn text,
  add column if not exists kontakt_telefon text,
  add column if not exists kontakt_epost text;
