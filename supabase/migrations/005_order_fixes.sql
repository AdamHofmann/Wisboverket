-- order_inkop: fil_url/fil_namn kolumner saknades trots att InkopTab.tsx läser/skriver dem
alter table order_inkop
  add column if not exists fil_url text,
  add column if not exists fil_namn text;

-- suppliers: migration 003 försökte skapa om tabellen med 'kategori' men no-opade
-- eftersom 001 redan skapat den utan den kolumnen (UI:t i leverantorer/page.tsx kräver kategori)
alter table suppliers
  add column if not exists kategori text;
