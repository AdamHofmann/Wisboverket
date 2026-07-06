-- ============================================================================
-- 020_f_el_debitering_rpc.sql
-- Atomar el-debitering (POST /api/fastigheter/el-leverantor/[id]).
--
-- Bakgrund: routen raderade gamla f_eldebitering-rader for en leverantorsfaktura
-- och skapade nya i TVA separata steg (delete().eq() + insert()) UTAN transaktion
-- (risk for halvskapad state: gamla debiteringar raderas utan att nya hinner
-- skapas om nagot fallerar mitt i). Denna RPC gor bada stegen ATOMART.
--
-- All AFFARSLOGIK (avlasnings-/schablonberakning, forbrukning, belopp,
-- hyresgast-uppslag) berkanas i TypeScript (route.ts) och skickas hit som en
-- fardig jsonb-array med debiteringsrader. Denna funktion gor bara:
--   1. delete av gamla rader for leverantor_id
--   2. insert av alla nya rader
-- i EN transaktion (plpgsql-funktioner kor implicit i en transaktion).
--
-- OBS: kraver att f_eldebitering finns (016_fastigheter_schema.sql section 24).
-- ============================================================================

-- Ersatter alla debiteringsrader for en leverantorsfaktura atomart.
-- p_debiteringar ar en JSON-array:
-- [
--   {
--     "matare_id": "...",
--     "lokal_id": "..." | null,
--     "hyresgast_namn": "...",
--     "forbrukning": 123.45 | null,
--     "pris_per_kwh": 2.50,
--     "belopp": 308.63
--   },
--   ...
-- ]
-- Returnerar antal skapade rader.
create or replace function f_satt_el_debitering(
  p_leverantor_id text,
  p_debiteringar  jsonb
)
returns integer
language plpgsql
security invoker
as $$
declare
  d       jsonb;
  v_count integer := 0;
begin
  -- 1. Ta bort gamla debiteringar for leverantorsfakturan
  delete from f_eldebitering where leverantor_id = p_leverantor_id;

  -- 2. Skapa nya debiteringar
  for d in select * from jsonb_array_elements(coalesce(p_debiteringar, '[]'::jsonb))
  loop
    insert into f_eldebitering (
      id, leverantor_id, matare_id, lokal_id,
      hyresgast_namn, forbrukning, pris_per_kwh, belopp
    )
    values (
      gen_random_uuid()::text,
      p_leverantor_id,
      d->>'matare_id',
      d->>'lokal_id',
      d->>'hyresgast_namn',
      case when d->>'forbrukning' is null then null else (d->>'forbrukning')::numeric end,
      (d->>'pris_per_kwh')::numeric,
      (d->>'belopp')::numeric
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
