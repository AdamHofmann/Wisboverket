-- Löpande ärendenummer för felanmälningar (FA-1001, FA-1002, ...)
-- Kunden ser numret direkt vid inskickad felanmälan; samma nummer visas i Inkorgen
-- så du kan slå upp ärendet.

alter table felanmalningar add column if not exists nummer bigint;

create sequence if not exists felanmalan_nummer_seq;

-- Backfilla befintliga rader i skapandeordning (börjar på 1001).
update felanmalningar f
set nummer = sub.n
from (
  select id, 1000 + row_number() over (order by created_at) as n
  from felanmalningar
  where nummer is null
) sub
where f.id = sub.id;

-- Låt sekvensen fortsätta efter högsta befintliga numret (minst 1000 → nästa blir 1001).
select setval('felanmalan_nummer_seq', greatest(1000, coalesce((select max(nummer) from felanmalningar), 1000)));

-- Nya rader får nästa nummer automatiskt.
alter table felanmalningar alter column nummer set default nextval('felanmalan_nummer_seq');
