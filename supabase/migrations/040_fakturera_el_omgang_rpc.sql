-- ============================================================================
-- 040_fakturera_el_omgang_rpc.sql
-- Atomär el-faktureringsomgång (tabellerna `f_faktura`, `f_fakturarad`,
-- `f_eldebitering`).
--
-- Bakgrund: API-routen (el-omgang/[id]/fakturera) loopade per hyresgäst och
-- gjorde tre skrivningar var UTAN transaktion — INSERT f_faktura, INSERT
-- f_fakturarad, UPDATE f_eldebitering (markera fakturerad). Den sista updaten
-- kollade inte ens `error`. Om något fallerade mitt i en omgång skapades
-- kompletta fakturor för hyresgäst 1–2 medan resten inte skapades, ELLER
-- fakturor skapades utan att debiteringarna markerades → dubbelfakturering.
-- Migration 037_reset_orphaned_el_debitering var en engångsstädning av just
-- detta symptom.
--
-- Denna RPC persisterar HELA omgången atomärt: allt eller inget. All
-- resolvering/gruppering/radbygge görs i TypeScript (route.ts). Nära kopia av
-- f_skapa_fakturor (017) men markerar även debiteringarna. Kör i Supabase.
--
-- p_fakturor är en JSON-array, ett element per hyresgäst:
-- [
--   {
--     "fakturanummer": "F202601-EL-1234",
--     "hyresavtal_id": null,
--     "hyresgast_id": "…",
--     "bolag_id": "…",
--     "belopp": 1234.00,
--     "period": "2026-01",
--     "forfallodag": "2026-01-31T00:00:00Z",
--     "status": "ej_skickad",
--     "typ": "el",
--     "rader": [ { "artikelkod":"EL","beskrivning":"El – …","antal":123,"apris":2.5,
--                  "belopp":307.5,"moms":25,"start_varde":1000,"slut_varde":1123,
--                  "avlast_fran":"2025-12-01","avlast_till":"2025-12-31" }, ... ],
--     "debitering_ids": ["…","…"]
--   }, ...
-- ]
-- Returnerar text[] med skapade faktura-id:n.
-- ============================================================================

create or replace function fakturera_el_omgang(p_fakturor jsonb)
returns text[]
language plpgsql
security invoker
as $$
declare
  f            jsonb;
  r            jsonb;
  v_faktura_id text;
  v_deb_ids    text[];
  v_ids        text[] := '{}';
begin
  for f in select * from jsonb_array_elements(p_fakturor)
  loop
    -- 1. Skapa fakturan
    insert into f_faktura (
      id, fakturanummer, hyresavtal_id, hyresgast_id, bolag_id,
      belopp, period, forfallodag, status, typ
    ) values (
      gen_random_uuid()::text,
      f->>'fakturanummer',
      nullif(f->>'hyresavtal_id', ''),
      nullif(f->>'hyresgast_id', ''),
      nullif(f->>'bolag_id', ''),
      (f->>'belopp')::numeric,
      f->>'period',
      (f->>'forfallodag')::timestamptz,
      coalesce(f->>'status', 'ej_skickad'),
      coalesce(f->>'typ', 'el')
    )
    returning id into v_faktura_id;

    -- 2. Skapa fakturaraderna
    for r in select * from jsonb_array_elements(f->'rader')
    loop
      insert into f_fakturarad (
        id, faktura_id, artikelkod, beskrivning, antal, apris, belopp, moms,
        start_varde, slut_varde, avlast_fran, avlast_till
      ) values (
        gen_random_uuid()::text,
        v_faktura_id,
        r->>'artikelkod',
        r->>'beskrivning',
        coalesce((r->>'antal')::numeric, 0),
        (r->>'apris')::numeric,
        (r->>'belopp')::numeric,
        coalesce((r->>'moms')::numeric, 0),
        nullif(r->>'start_varde', '')::numeric,
        nullif(r->>'slut_varde', '')::numeric,
        nullif(r->>'avlast_fran', '')::date,
        nullif(r->>'avlast_till', '')::date
      );
    end loop;

    -- 3. Markera debiteringarna som fakturerade (samma transaktion som fakturan)
    select array_agg(x) into v_deb_ids
    from jsonb_array_elements_text(f->'debitering_ids') as t(x);

    if v_deb_ids is not null then
      update f_eldebitering
        set status = 'fakturerad', faktura_id = v_faktura_id, fakturerad_datum = now()
        where id = any(v_deb_ids);
    end if;

    v_ids := v_ids || v_faktura_id;
  end loop;

  return v_ids;
end;
$$;
