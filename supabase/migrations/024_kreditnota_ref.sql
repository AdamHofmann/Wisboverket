-- Kreditnota ska visa vilken faktura den krediterar. Snapshotta ursprungsnumret
-- vid krediteringstillfället (robust mot framtida omnumrering, t.ex. Hogia).
alter table fakturor add column if not exists original_faktura_nummer text;

-- Backfill befintliga kreditnotor från den refererade ursprungsfakturan
update fakturor k
set original_faktura_nummer = o.fakturanummer
from fakturor o
where k.original_faktura_id = o.id
  and k.original_faktura_nummer is null;
