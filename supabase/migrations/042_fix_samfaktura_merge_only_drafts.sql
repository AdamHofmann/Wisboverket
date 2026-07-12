-- ============================================================================
-- 042_fix_samfaktura_merge_only_drafts.sql
-- BUGGFIX: f_merge_samfaktura slog ihop en NYSKAPAD faktura (utkast) med en
-- REDAN SKICKAD/BETALD faktura för samma hyresgäst+period. Konsekvens:
--   1. Det nya utkastet raderades → generering rapporterade "0 skapade" utan fel
--      (såg ut som om fakturering var trasig för redan delvis fakturerade perioder).
--   2. Utkastets rader flyttades TYST över till den skickade fakturan och dess
--      belopp räknades upp → korrupt/förhöjd redan skickad faktura.
--
-- Mergen ska bara samfakturera UTKAST från samma körning. Skickade/betalda/
-- krediterade fakturor ska aldrig röras. Fix: filtrera på status = 'ej_skickad'
-- i alla tre stegen (periodurval, behåll-val, merge-loop).
-- ============================================================================

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
    select period
    from f_faktura
    where hyresavtal_id = any(p_avtal_ids) and status = 'ej_skickad'
    group by period
    having count(*) > 1
  loop
    -- Behåll den först skapade UTKAST-fakturan för perioden
    select id into v_keep
    from f_faktura
    where hyresavtal_id = any(p_avtal_ids) and period = v_period and status = 'ej_skickad'
    order by created_at asc, id asc
    limit 1;

    -- Flytta rader från övriga UTKAST till behållen, ta bort dem
    for v_merge in
      select id from f_faktura
      where hyresavtal_id = any(p_avtal_ids)
        and period = v_period
        and status = 'ej_skickad'
        and id <> v_keep
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
