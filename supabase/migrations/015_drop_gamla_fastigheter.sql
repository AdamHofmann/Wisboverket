-- ============================================================================
-- 015_drop_gamla_fastigheter.sql
--
-- RENSNING: droppar det GAMLA, halvfärdiga engelska fastighets-försöket från
-- 001_initial_schema.sql (companies/properties/buildings/units/tenants/leases/
-- lease_rows/index_adjustments/operating_costs/maintenance/maintenance_log/
-- electricity_meters/electricity_readings/messages).
--
-- Syfte: rensa vägen för den nya svenska f_-modulen (se
-- docs/fastigheter-migration/SCHEMA.sql, läggs som nästa migration) som portar
-- hela hofmanns-fastigheter (26 Prisma-modeller) med riktig data.
--
-- Dessa tabeller är tomma platshållare och används inte i produktion. All
-- fastighetsfunktionalitet ersätts av f_-tabellerna. Order-modulens tabeller
-- (customers, orders, offers, invoices, articles m.fl.) berörs INTE.
--
-- `cascade` tar med FK-beroenden, index, policies och ev. vyer automatiskt.
-- Drop-ordningen nedan är barn-före-förälder ändå, för tydlighet.
-- `if exists` gör migrationen idempotent och säker att köra om.
-- ============================================================================

-- Beroende barntabeller först
drop table if exists lease_rows           cascade;
drop table if exists index_adjustments    cascade;
drop table if exists maintenance_log      cascade;
drop table if exists maintenance          cascade;
drop table if exists operating_costs      cascade;
drop table if exists electricity_readings cascade;
drop table if exists electricity_meters   cascade;
drop table if exists messages             cascade;
drop table if exists leases               cascade;
drop table if exists units                cascade;
drop table if exists buildings            cascade;
drop table if exists tenants              cascade;

-- Föräldratabeller sist
drop table if exists properties           cascade;
drop table if exists companies            cascade;
