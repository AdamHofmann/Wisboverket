-- 041: Ta bort dubblett-artiklar (order-modulen) + förhindra nya.
--
-- Orsak: artiklar.artikelnummer saknade unik constraint, så startseeden i
-- migration 002 (`on conflict do nothing`) konfliktade bara på id (ny uuid
-- varje körning) → varje körning av 002 la in en ny uppsättning dubbletter.
--
-- Fix: behåll den ÄLDSTA raden per artikelnummer, peka om referenser till den,
-- radera resten, och lägg på en unik index så det inte kan hända igen.
-- (Fastigheternas f_artikel har redan `kod unique` → inga dubbletter där.)

begin;

-- 1. Kanonisk (behållen) rad per artikelnummer, äldst först.
--    Rader utan artikelnummer dedupas per namn istället.
create temporary table _artikel_keep on commit drop as
select id as keep_id, grp
from (
  select id,
         coalesce(artikelnummer, 'namn:' || namn) as grp,
         row_number() over (
           partition by coalesce(artikelnummer, 'namn:' || namn)
           order by created_at, id
         ) as rn
  from artiklar
) t
where rn = 1;

-- 2. Mappa varje dubblett → dess kanoniska rad.
create temporary table _artikel_map on commit drop as
select a.id as dup_id, k.keep_id
from artiklar a
join _artikel_keep k
  on coalesce(a.artikelnummer, 'namn:' || a.namn) = k.grp
where a.id <> k.keep_id;

-- 3. Peka om order-tidrader till den kanoniska artikeln.
update order_tid_rader t
set artikel_id = m.keep_id
from _artikel_map m
where t.artikel_id = m.dup_id;

-- 4. Prisavtal har unik (customer_id, artikel_id): ta först bort de dubblett-
--    kopplingar som skulle krocka med en redan befintlig kanonisk koppling,
--    peka sedan om resten.
delete from kund_prisavtal p
using _artikel_map m
where p.artikel_id = m.dup_id
  and exists (
    select 1 from kund_prisavtal p2
    where p2.customer_id = p.customer_id and p2.artikel_id = m.keep_id
  );

update kund_prisavtal p
set artikel_id = m.keep_id
from _artikel_map m
where p.artikel_id = m.dup_id;

-- 5. Radera dubbletterna.
delete from artiklar a
using _artikel_map m
where a.id = m.dup_id;

-- 6. Förhindra framtida dubbletter på artikelnummer.
create unique index if not exists uq_artiklar_artikelnummer
  on artiklar (artikelnummer)
  where artikelnummer is not null;

commit;

-- Verifiering (ska returnera 0 rader):
select artikelnummer, count(*) as antal
from artiklar
where artikelnummer is not null
group by artikelnummer
having count(*) > 1;
