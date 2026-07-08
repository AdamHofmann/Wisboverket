-- ============================================================================
-- 039_skapa_order_faktura_rpc.sql
-- Atomärt fakturaskapande för en order (tabellerna `fakturor`, `orders`,
-- `order_tid_rader`).
--
-- Bakgrund: klienten (TidFaktureringTab.skapaFakturaFn) gjorde tre separata
-- skrivningar utan transaktion — INSERT faktura, UPDATE orders (fakturerat),
-- UPDATE order_tid_rader (lås tidposter). Om skrivning 2 eller 3 misslyckades
-- fanns fakturan men ordern/tidraderna stod olåsta → dubbelfaktureringsrisk.
-- Denna RPC gör alla tre atomärt och returnerar hela fakturaraden (klienten
-- behöver den för skicka-/PDF-flödet).
--
-- All beräkning (rader, förfallodatum, moms) görs i TypeScript. Kör i Supabase.
-- ============================================================================

create or replace function skapa_order_faktura(
  p_faktura jsonb,
  p_order_id uuid,
  p_order_patch jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_row fakturor;
begin
  -- 1. Skapa fakturan
  insert into fakturor (
    fakturanummer, forfallodatum, order_id, customer_id, rader,
    moms_pct, subtotal, moms_belopp, totalt,
    kund_namn, kund_orgnr, kund_epost, referens, status
  ) values (
    p_faktura->>'fakturanummer',
    nullif(p_faktura->>'forfallodatum', '')::date,
    p_order_id,
    nullif(p_faktura->>'customer_id', '')::uuid,
    coalesce(p_faktura->'rader', '[]'::jsonb),
    coalesce((p_faktura->>'moms_pct')::numeric, 25),
    (p_faktura->>'subtotal')::numeric,
    (p_faktura->>'moms_belopp')::numeric,
    (p_faktura->>'totalt')::numeric,
    p_faktura->>'kund_namn',
    p_faktura->>'kund_orgnr',
    p_faktura->>'kund_epost',
    p_faktura->>'referens',
    coalesce(p_faktura->>'status', 'skickad')
  )
  returning * into v_row;

  -- 2. Markera ordern fakturerad
  update orders set
    fakturerat = coalesce((p_order_patch->>'fakturerat')::boolean, true),
    fakturerat_belopp = nullif(p_order_patch->>'fakturerat_belopp', '')::numeric,
    fakturadatum = nullif(p_order_patch->>'fakturadatum', '')::date,
    status = coalesce(p_order_patch->>'status', status)
  where id = p_order_id;

  -- 3. Lås orderns tidposter
  update order_tid_rader set fakturerad = true where order_id = p_order_id;

  return to_jsonb(v_row);
end;
$$;
