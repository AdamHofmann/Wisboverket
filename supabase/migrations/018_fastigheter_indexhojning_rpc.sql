-- ============================================================================
-- 018_fastigheter_indexhojning_rpc.sql
-- Atomär KPI-indexhöjning (POST /api/fastigheter/indexhojningar).
--
-- Bakgrund: käll-appen (Prisma) loopade per avtal och gjorde
--   1. create f_indexhojning (logg)
--   2. update f_hyresavtal.bashyra
-- UTAN transaktion (risk för halvskapad state om något avtal fallerar mitt i).
-- I Supabase gör vi hela batchen ATOMÄR via denna RPC.
--
-- Skillnad mot PLAN.md-skissen: här bevaras källans fulla beteende — kpi_gammal,
-- kpi_ny och datum skickas in från klienten (skissen hårdkodade 0/0/now()).
-- Avrundning matchar källans Math.round(x*100)/100 = round(x, 2).
--
-- OBS: kräver att f_indexhojning / f_hyresavtal finns (SCHEMA.sql §8, §12).
-- ============================================================================

create or replace function f_apply_indexhojning(
  p_avtal_ids   text[],
  p_kpi_gammal  numeric,
  p_kpi_ny      numeric,
  p_procent     numeric,
  p_datum       timestamptz,
  p_skapad_av   text
)
returns setof f_indexhojning
language plpgsql
security invoker
as $$
declare
  a            record;
  v_bashyra_ny numeric(14,2);
begin
  for a in
    select id, bashyra from f_hyresavtal where id = any(p_avtal_ids)
  loop
    -- Matcha källans Math.round(avtal.bashyra * (1 + procent/100) * 100) / 100
    v_bashyra_ny := round(a.bashyra * (1 + p_procent / 100.0), 2);

    return query
    insert into f_indexhojning (
      id, hyresavtal_id, datum, kpi_gammal, kpi_ny, procent,
      bashyra_gammal, bashyra_ny, skapad_av
    )
    values (
      gen_random_uuid()::text,
      a.id,
      coalesce(p_datum, now()),
      p_kpi_gammal,
      p_kpi_ny,
      p_procent,
      a.bashyra,
      v_bashyra_ny,
      coalesce(p_skapad_av, 'System')
    )
    returning *;

    update f_hyresavtal set bashyra = v_bashyra_ny where id = a.id;
  end loop;
end;
$$;
