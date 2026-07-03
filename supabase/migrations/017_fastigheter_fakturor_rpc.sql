-- ============================================================================
-- 017_fastigheter_fakturor_rpc.sql
-- Atomär fakturagenerering för hyres-fakturering (POST /api/fastigheter/fakturor).
--
-- Bakgrund: käll-appen (Prisma) skapade fakturor + rader + samfaktura-merge i en
-- lös följd av queries UTAN transaktion (risk för halvskapad state). I Supabase
-- gör vi persisteringen ATOMÄR via denna RPC. All AFFÄRSLOGIK (kvartal/månad,
-- KPI-index, öresavrundning, dublettspärr, samfakturerings-gruppering) beräknas
-- i TypeScript (src/lib/fastigheter/fakturering.ts / route.ts) och skickas hit
-- som färdiga fakturor-objekt. Denna funktion gör bara:
--   1. insert av alla fakturor + deras rader
--   2. (valfritt) samfakturerings-merge: slå ihop fakturor per hyresgäst+period
--
-- OBS: kräver att f_faktura / f_fakturarad / f_hyresavtal finns (SCHEMA.sql).
-- Kör efter att f_-schemat applicerats.
-- ============================================================================

-- Skapar fakturor (och rader) atomärt. p_fakturor är en JSON-array:
-- [
--   {
--     "fakturanummer": "F202601-1234",
--     "hyresavtal_id": "…",
--     "belopp": 12345.00,
--     "period": "2026-01",
--     "forfallodag": "2025-12-31T00:00:00Z",
--     "status": "ej_skickad",
--     "rader": [
--       { "artikelkod":"HYR","beskrivning":"…","antal":3,"apris":1000,"belopp":3000,"moms":25 },
--       ...
--     ]
--   },
--   ...
-- ]
-- Returnerar antal skapade fakturor.
create or replace function f_skapa_fakturor(p_fakturor jsonb)
returns integer
language plpgsql
security invoker
as $$
declare
  f            jsonb;
  r            jsonb;
  v_faktura_id text;
  v_count      integer := 0;
begin
  for f in select * from jsonb_array_elements(p_fakturor)
  loop
    insert into f_faktura (id, fakturanummer, hyresavtal_id, belopp, period, forfallodag, status)
    values (
      gen_random_uuid()::text,
      f->>'fakturanummer',
      f->>'hyresavtal_id',
      (f->>'belopp')::numeric,
      f->>'period',
      (f->>'forfallodag')::timestamptz,
      coalesce(f->>'status', 'ej_skickad')
    )
    returning id into v_faktura_id;

    for r in select * from jsonb_array_elements(f->'rader')
    loop
      insert into f_fakturarad (id, faktura_id, artikelkod, beskrivning, antal, apris, belopp, moms)
      values (
        gen_random_uuid()::text,
        v_faktura_id,
        r->>'artikelkod',
        r->>'beskrivning',
        coalesce((r->>'antal')::numeric, 1),
        (r->>'apris')::numeric,
        (r->>'belopp')::numeric,
        coalesce((r->>'moms')::numeric, 0)
      );
    end loop;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Samfakturerings-merge: för givna hyresavtal-id:n (samma hyresgäst) slås
-- fakturor med samma period ihop till en (behåll äldsta/först, flytta rader,
-- ta bort resten, uppdatera totalbelopp). Atomärt.
create or replace function f_merge_samfaktura(p_avtal_ids text[])
returns void
language plpgsql
security invoker
as $$
declare
  v_period   text;
  v_keep     text;
  v_merge    text;
  v_total    numeric;
begin
  for v_period in
    select distinct period
    from f_faktura
    where hyresavtal_id = any(p_avtal_ids)
    group by period
    having count(*) > 1
  loop
    -- Behåll den först skapade fakturan för perioden
    select id into v_keep
    from f_faktura
    where hyresavtal_id = any(p_avtal_ids) and period = v_period
    order by created_at asc, id asc
    limit 1;

    -- Flytta rader från övriga till behållen, ta bort övriga
    for v_merge in
      select id from f_faktura
      where hyresavtal_id = any(p_avtal_ids) and period = v_period and id <> v_keep
    loop
      update f_fakturarad set faktura_id = v_keep where faktura_id = v_merge;
      delete from f_faktura where id = v_merge;
    end loop;

    -- Uppdatera totalbelopp på behållen faktura
    select coalesce(sum(belopp), 0) into v_total
    from f_fakturarad where faktura_id = v_keep;
    update f_faktura set belopp = v_total where id = v_keep;
  end loop;
end;
$$;
