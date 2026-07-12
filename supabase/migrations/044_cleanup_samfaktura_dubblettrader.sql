-- ============================================================================
-- 044_cleanup_samfaktura_dubblettrader.sql  (ENGÅNGS-DATASTÄDNING)
-- Rensar dubblettrader på ej_skickade utkast som uppstått av samfaktura-
-- återskapa-remerge-cykeln (se route.ts-fixen): vid varje generering återskapades
-- sekundär-avtalens fakturor och mergades in på primär-utkastet igen → EXAKTA
-- kopior av samma rad staplades på + beloppet blåstes upp.
--
-- Tar bort exakta dubblettrader (behåller den först skapade) och räknar om belopp.
-- Rör BARA ej_skickad (utkast). Distinkta rader (olika lokaler i en äkta
-- samfaktura) är inte exakta dubbletter → lämnas orörda.
--
-- Kör EFTER route.ts-fixen (annars återkommer dubbletterna vid nästa generering).
-- ============================================================================

begin;

-- 1. Ta bort exakta dubblettrader — behåll den först skapade per unik rad.
with ranked as (
  select fr.id,
    row_number() over (
      partition by fr.faktura_id, fr.artikelkod, fr.beskrivning, fr.belopp, fr.antal, fr.apris, fr.moms
      order by fr.created_at asc, fr.id asc
    ) as rn
  from f_fakturarad fr
  join f_faktura f on f.id = fr.faktura_id
  where f.status = 'ej_skickad'
)
delete from f_fakturarad where id in (select id from ranked where rn > 1);

-- 2. Räkna om belopp från kvarvarande rader (bara utkast).
update f_faktura f
set belopp = coalesce(
  (select sum(fr.belopp) from f_fakturarad fr where fr.faktura_id = f.id), 0)
where f.status = 'ej_skickad';

-- 3. Verifiera: utkasten med rätt (nedbantade) radantal + belopp.
select f.fakturanummer, f.period, f.belopp,
       (select count(*) from f_fakturarad fr where fr.faktura_id = f.id) as antal_rader
from f_faktura f
where f.status = 'ej_skickad'
order by f.fakturanummer;

commit;
