-- ============================================================================
-- 038_kreditera_faktura_rpc.sql
-- Atomär kreditering av en orderfaktura (tabellen `fakturor`).
--
-- Bakgrund: klienten (FakturorTab.kreditera) gjorde tidigare två separata
-- skrivningar utan transaktion — INSERT kreditnota, sedan UPDATE originalets
-- status. Om andra skrivningen misslyckades fanns kreditnotan men originalet
-- behöll gammal status (inkonsistens). Denna RPC gör båda atomärt.
--
-- All beräkning (rader, belopp, moms, full-/delkreditering) görs i TypeScript;
-- funktionen persisterar bara. Följer mönstret från 017_fastigheter_fakturor_rpc.
-- Kör i Supabase SQL-editorn.
-- ============================================================================

create or replace function kreditera_faktura(
  p_kreditnota jsonb,
  p_original_id uuid,
  p_is_full boolean
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  -- 1. Skapa kreditnotan
  insert into fakturor (
    fakturanummer, order_id, typ, status, rader,
    subtotal, moms_belopp, totalt, kund_namn, original_faktura_id
  ) values (
    p_kreditnota->>'fakturanummer',
    nullif(p_kreditnota->>'order_id', '')::uuid,
    coalesce(p_kreditnota->>'typ', 'kreditnota'),
    coalesce(p_kreditnota->>'status', 'kreditnota'),
    coalesce(p_kreditnota->'rader', '[]'::jsonb),
    (p_kreditnota->>'subtotal')::numeric,
    (p_kreditnota->>'moms_belopp')::numeric,
    (p_kreditnota->>'totalt')::numeric,
    p_kreditnota->>'kund_namn',
    p_original_id
  )
  returning id into v_id;

  -- 2. Markera originalet (samma transaktion → rullas tillbaka om något ovan fallerar)
  update fakturor
    set status = case when p_is_full then 'krediterad' else 'delkrediterad' end,
        updated_at = now()
    where id = p_original_id;

  return v_id;
end;
$$;
