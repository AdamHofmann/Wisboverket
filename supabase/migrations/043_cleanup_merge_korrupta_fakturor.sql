-- ============================================================================
-- 043_cleanup_merge_korrupta_fakturor.sql  (ENGÅNGS-DATASTÄDNING)
-- Reparerar de tre skickade fakturor som merge-buggen (se 042) blåste upp genom
-- att flytta in rader från nyskapade utkast. Varje faktura har 8 riktiga rader
-- (skapade när fakturan skapades, 2026-07-05) + 48 felaktigt inflyttade rader
-- (skapade vid senare testkörningar). Vi tar bort de inflyttade och räknar om
-- beloppet till korrekt nivå (25 784 kr styck, verifierat via preview).
--
-- Kör EFTER 042 (annars återskapas problemet vid nästa generering).
-- ============================================================================

begin;

-- 1. Ta bort de inflyttade (felaktiga) raderna — bara rader skapade > 1 min
--    efter själva fakturan, och bara på de tre kända korrupta fakturorna.
delete from f_fakturarad fr
using f_faktura f
where fr.faktura_id = f.id
  and f.fakturanummer in ('F202607-2055', 'F202607-3067', 'F202607-7988')
  and fr.created_at > f.created_at + interval '1 minute';

-- 2. Räkna om beloppet från kvarvarande original-rader.
update f_faktura f
set belopp = coalesce(
  (select sum(fr.belopp) from f_fakturarad fr where fr.faktura_id = f.id), 0)
where f.fakturanummer in ('F202607-2055', 'F202607-3067', 'F202607-7988');

-- 3. Verifiera: ska visa 3 fakturor med 8 rader var och belopp 25784.00.
select f.fakturanummer, f.period, f.belopp,
       (select count(*) from f_fakturarad fr where fr.faktura_id = f.id) as antal_rader
from f_faktura f
where f.fakturanummer in ('F202607-2055', 'F202607-3067', 'F202607-7988')
order by f.fakturanummer;

commit;
