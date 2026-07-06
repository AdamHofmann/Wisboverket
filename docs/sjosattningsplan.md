# Sjösättningsplan – Wisboverket

Rätt-dimensionerad för appens faktiska skala (internt system, en handfull användare).
Stacken är redan produktionsduglig: **TypeScript + Next.js + Supabase (Postgres)**.
Undvik enterprise-infra (AWS ECS/ECR/RDS/Amplify/Datadog) – onödig kostnad och komplexitet i denna storlek.

## 1. Arkitektur (målbild)
- **Frontend + backend:** samma Next.js-app, deployas till **Vercel** (Next.js egna hosting – enklast, en git-push = deploy).
- **Databas + auth + fillagring:** **Supabase** (managed Postgres, körs redan på AWS under huven).
- **Felspårning:** **Sentry** (se §6).
- **Domän:** hofmannsab.se / kommande Wisboverket-domän kopplas till Vercel när namnet är godkänt.

## 2. Databas
- PostgreSQL via Supabase. Alla migrationer i `supabase/migrations/` – körs manuellt i Supabase SQL Editor (aldrig automatiskt).
- **RLS på varje tabell** – `using ((select auth.uid()) is not null)`. Verifiera att RLS är PÅ på samtliga f_-tabeller innan lansering (en tabell utan RLS = öppen data).
- Skapa en **staging-/test-databas** separat från produktion så migrationer kan provas först.

## 3. Backuper
- Supabase tar **automatiska dagliga backuper** (Pro-plan ger point-in-time recovery). Verifiera vilken plan som gäller.
- Komplettera med en **schemalagd egen export** (pg_dump) till OneDrive/annan plats för extra trygghet – t.ex. veckovis.
- Testa en **återställning** minst en gång innan skarp drift (en backup man aldrig testat är ingen backup).

## 4. Deploy
- Koppla GitHub-repo (privat) → Vercel. Push till `main` = produktion; feature-branchar = preview-deploys.
- **Secrets:** alla nycklar (SUPABASE_SERVICE_ROLE_KEY m.fl.) som env-vars i Vercel. `.env.local` är gitignorad – committa ALDRIG nycklar. Service-role-nyckeln endast server-side.
- **Deploya aldrig automatiskt utan Adams klartecken** (stående regel).

## 5. Fleranvändare / isolering
- Supabase Auth för inloggning. Idag ser varje inloggad användare all data (RLS = `auth.uid() is not null`).
- Inför lansering: bestäm om alla användare ska se allt (dagens modell) eller om data ska avgränsas per bolag/roll. Om per roll → utöka RLS-policys. Dokumentera valet.
- Lägg upp riktiga användarkonton, ta bort ev. test-konton.

## 6. Felspårning & övervakning
- **Sentry** (`@sentry/nextjs`): fångar krascher/undantag i produktion med stacktrace, fil och rad → du får veta *när och varför* appen fallerar hos en användare. Hög nytta, låg insats. Läggs in vid lansering.
  - Sätt DSN som env-var, aktivera i både klient och server, sampla prestanda lågt (kostnad).
- **Befintlig systemlogg** (`app_logg`, Inställningar → Systemlogg) behålls som app-intern logg (fel + prestanda). Sentry = extern, mer detaljerad; systemloggen = snabb överblick i appen.
- **Hoppa** Datadog/PostHog tills vidare (enterprise-analys resp. produktanalys – ej motiverat i denna skala; PostHog kan övervägas senare om användningsstatistik önskas).

## 7. Checklista före skarp lansering
- [ ] Alla migrationer körda i produktions-Supabase (senast: `031_artikelregister.sql`).
- [ ] RLS verifierad PÅ på alla f_-tabeller.
- [ ] Backup testad (återställning fungerar).
- [ ] Env-vars satta i Vercel, inga secrets i git.
- [ ] Sentry inkopplat och testat (trigga ett testfel).
- [ ] Riktiga användarkonton skapade, testdata rensad.
- [ ] Domän kopplad (efter Wisboverket-namnbyte).
- [ ] Adams klartecken för deploy.
