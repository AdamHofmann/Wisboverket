-- Faktura-tidslinje: händelselogg per hyresfaktura. "Skapad" härleds från
-- f_faktura.created_at; övriga händelser (skickad/betald/krediterad/öppnad) loggas här.
-- "öppnad" (kunden har öppnat fakturan) kopplas in när leveransvägen (Hogia/mejl) är spikad.
create table if not exists f_faktura_handelse (
  id         text primary key default gen_random_uuid()::text,
  faktura_id text not null references f_faktura(id) on delete cascade,
  typ        text not null,          -- 'skickad' | 'betald' | 'krediterad' | 'oppnad'
  meddelande text,
  created_at timestamptz not null default now()
);
create index if not exists idx_f_faktura_handelse_faktura on f_faktura_handelse(faktura_id);

alter table f_faktura_handelse enable row level security;
drop policy if exists f_faktura_handelse_all on f_faktura_handelse;
create policy f_faktura_handelse_all on f_faktura_handelse for all
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

-- Backfill: befintliga fakturor som inte är 'ej_skickad' får en händelse vid updated_at
-- så tidslinjen visar något direkt (approximativt — bara senaste statustidpunkten finns).
insert into f_faktura_handelse (faktura_id, typ, meddelande, created_at)
select id, status, 'Bakåtfyllt', updated_at
from f_faktura
where status in ('skickad','betald','krediterad')
  and not exists (select 1 from f_faktura_handelse h where h.faktura_id = f_faktura.id);
