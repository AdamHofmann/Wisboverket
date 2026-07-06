-- Artikelregister: en central katalog över fakturaartiklar så att fakturatexter,
-- moms och (framöver) Hogia-konton hålls konsekventa. Fakturarader fortsätter lagra
-- artikelkod + fritext (historik ska inte ändras retroaktivt), men nya rader väljs
-- från registret så benämning/á-pris/moms autofylls.

create table if not exists f_artikel (
  id          text primary key default gen_random_uuid()::text,
  kod         text not null unique,          -- kort kod, t.ex. 'HYR', 'STAD', 'EL'
  benamning   text not null,                 -- fakturatexten, t.ex. "Städning trapphus"
  apris       numeric(14,2),                 -- standardpris (null = variabelt/anges per rad)
  moms        numeric not null default 25,   -- momssats i procent
  konto       text,                          -- Hogia bokföringskonto (fylls när Hogia kopplas)
  momskod     text,                          -- Hogia momskod
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_f_artikel_aktiv on f_artikel (aktiv);
drop trigger if exists trg_f_artikel_updated_at on f_artikel;
create trigger trg_f_artikel_updated_at before update on f_artikel
  for each row execute function update_updated_at_column();

alter table f_artikel enable row level security;

drop policy if exists f_artikel_read on f_artikel;
create policy f_artikel_read on f_artikel for select
  using ((select auth.uid()) is not null);

drop policy if exists f_artikel_write on f_artikel;
create policy f_artikel_write on f_artikel for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- Systemartiklar som redan används av fakturagenereringen (konto lämnas tomt tills
-- Hogia-kontoplanen är på plats). on conflict → säkert att köra flera gånger.
insert into f_artikel (kod, benamning, moms) values
  ('HYR',     'Hyra',                 25),
  ('IDX',     'Indextillägg KPI',     25),
  ('FSKATT',  'Fastighetsskatt',      25),
  ('TILLAGG', 'Tillägg',              25),
  ('EL',      'El',                   25),
  ('VARME',   'Värme',                25),
  ('VATTEN',  'Vatten & avlopp',      25),
  ('STAD',    'Städning',             25),
  ('PARK',    'Parkering',            25),
  ('ORE',     'Öreutjämning',          0),
  ('MAN',     'Övrigt (manuell rad)', 25)
on conflict (kod) do update set benamning = excluded.benamning, moms = excluded.moms;
