# INVENTORY — Fastigheter → Order-appen (wisboverket)

Komplett inventering av käll-appen `hofmanns-fastigheter` som ska föras in i
`wisboverket` som en delad app-modul under `/fastigheter`, med datalagret
porterat från Prisma/libSQL (Turso) till Supabase (Postgres).

> **VIKTIG UPPTÄCKT (påverkar hela migreringen):** Mål-appen har REDAN en
> halvfärdig fastighets-migration som INTE nämns i de sex analyserna:
> - `supabase/migrations/001_initial_schema.sql` innehåller redan 14
>   fastighets­tabeller med **engelska namn** (`companies`, `properties`,
>   `buildings`, `units`, `tenants`, `leases`, `lease_rows`,
>   `index_adjustments`, `operating_costs`, `maintenance`, `maintenance_log`,
>   `electricity_meters`, `electricity_readings`, `messages`).
> - Fyra stub-sidor finns redan:
>   `src/app/(app)/{fastigheter,hyresavtal,hyresgaster,underhall}/page.tsx`.
> - Navbar har redan en `/fastigheter`-länk (rad 14) och en `/uthyrning`-länk.
> - **Men det är trasigt/inkonsekvent:** stub-sidorna importerar `@/types`
>   (filen `src/types.ts` finns INTE), och de frågar mot en blandning av
>   engelska tabeller som finns (`properties`, `units`, `leases`, `tenants`,
>   `maintenance`) OCH svenska tabeller som INTE finns (`fastigheter`,
>   `fastighet_underhall`). `orders`-tabellen saknar dessutom `fastighet_id`
>   som stubben joinar mot. Kort sagt: stubbarna kompilerar/kör inte.
>
> Konsekvens: den befintliga engelska schema-varianten är en **delmängd** av
> käll-appens 26 modeller (saknar ~12 tabeller och de flesta fält). Se PLAN.md
> för beslut: vi lägger till en NY, komplett fastighets-migration
> (`015_fastigheter_full.sql`) med det svenska/käll-troget namnschemat och
> ersätter/deprekerar stubbarna, hellre än att bygga vidare på det ofullständiga
> engelska 001-schemat.

---

## 1. Sidor / routes (käll-appen)

Käll-appen: Next.js App Router, alla sidor är Client Components (`'use client'`),
hämtar via `fetch('/api/...')`, redigerar i en `SlideOver`-panel. **12 sid-routes,
inga dynamiska sid-routes, ingen loading/error/not-found.**

| # | Route (källa) | Syfte | Nyckelberoenden |
|---|---|---|---|
| 1 | `/` (Dashboard) | KPI-kort, vakansgrad (yta/antal), hyresintäkt, avtal som löper ut inom 12 mån | `GET /api/dashboard?bolagId=` |
| 2 | `/fastigheter` | Fastigheter + byggnader + beteckningar (CRUD) | `/api/fastigheter`, `/api/byggnader`, `/api/beteckningar` |
| 3 | `/lokaler` | Lokaler (kontor/lager/bostad/garage/mark/parkering) | `/api/lokaler`, `/api/fastigheter` |
| 4 | `/hyresgaster` | Hyresgäster + kontaktpersoner + "placera i ledig lokal" | `/api/hyresgaster`, `/api/kontaktpersoner`, `/api/lokaler`, `/api/hyresavtal` |
| 5 | `/hyresavtal` | Hyresavtal (mest komplex): status-livscykel, index, uppsägning, PDF | `/api/hyresavtal`, `/api/indexhojningar`, `/api/avtalsdokument`, `/api/avtalsrader`, `/api/hyresavtal/[id]/pdf` |
| 6 | `/driftskostnader` | Driftskostnader per fastighet | `/api/driftskostnader` |
| 7 | `/elmatare` | Elmätare, 4 flikar (avläsning/leverantör/debitering/analys), AI-skanning | `/api/elmatare`, `/api/el-leverantor`, `/api/el-leverantor/skanna` |
| 8 | `/fakturering` | Generera hyresfakturor per period, PDF/print | `/api/fakturor`, `/api/fakturor/[id]`, `/api/fakturor/[id]/print` |
| 9 | `/ekonomi` | 3 flikar (nettoresultat/kassaflöde/lån) | `/api/statistik/*`, `/api/lan` |
| 10 | `/underhall` | Periodiska besiktningar/serviceärenden, åtgärdslogg | `/api/underhall`, `/api/underhall/[id]` |
| 11 | `/kommunikation` | Massutskick e-post till hyresgäster | `/api/meddelanden`, `/api/hyresgaster` |
| 12 | `/installningar` | Bolagsregister (CRUD), logotyp-upload, koppla fastigheter | `/api/bolag`, `/api/bolag/[id]`, `/api/bolag/[id]/logotyp` |

Global state i källan: **`BolagProvider`** (`src/context/BolagContext.tsx`) —
`{ bolagLista, valtBolagId, setValtBolagId, reloadBolag }`, persist i
`localStorage['valtBolagId']`, används som globalt filter överallt.

---

## 2. Datamodell (käll-appen: 26 Prisma-modeller)

PK = `String @id @default(cuid())`. Inga enums (fria `String`-fält med
kommenterade tillåtna värden). Belopp = `Float`. Se SCHEMA.sql för fullständig
Postgres-översättning.

| # | Modell | Kärna | Viktiga relationer / onDelete |
|---|---|---|---|
| 1 | `User` | NextAuth-user, `email` UNIQUE, password klartext | frikopplad |
| 2 | `Bolag` | fastighetsägande bolag / fakturaavsändare | 1-n → Fastighet |
| 3 | `Fastighet` | central entitet | n-1 Bolag (SetNull); 1-n Lokal, Byggnad, Beteckning, Driftskostnad, Underhall, ElMatare, ElLeverantorsfaktura, Lan |
| 4 | `Fastighetsbeteckning` | flera beteckningar/fastighet | n-1 Fastighet (Cascade) |
| 5 | `Byggnad` | byggnad (yta, energiklass, hiss/sprinkler/fiber…) | n-1 Fastighet (Cascade), n-1 Beteckning (SetNull) |
| 6 | `Lokal` | uthyrningsobjekt (typ/yta/status/bashyra/moms) | n-1 Fastighet (Cascade), Byggnad (SetNull), Beteckning |
| 7 | `Hyresgast` | företag/privat, samfakturering | 1-n Hyresavtal, Kontaktperson |
| 8 | `HyresavtalLokal` | **junction** n-n Hyresavtal↔Lokal | `@@unique([hyresavtalId, lokalId])` |
| 9 | `Hyresavtal` | stor entitet (~40 fält: status, index, uppsägning, abonnemang, moms…) | n-1 Hyresgast (Restrict); 1-n Faktura, Indexhojning, Avtalsrad, AvtalsDokument |
| 10 | `AvtalsDokument` | filbilaga på avtal | n-1 Hyresavtal (Cascade) — **fil i public/uploads** |
| 11 | `Avtalsrad` | extra debiteringsrad (FSKATT/LARM/FIBER…) | n-1 Hyresavtal (Cascade) |
| 12 | `Indexhojning` | KPI-höjningslogg | n-1 Hyresavtal (Cascade) |
| 13 | `Driftskostnad` | el/värme/vatten/sopor/försäkring | n-1 Fastighet (Cascade) |
| 14 | `Faktura` | hyresfaktura, `fakturanummer` UNIQUE | n-1 Hyresavtal (Cascade); 1-n FakturaRad |
| 15 | `FakturaRad` | fakturarad | n-1 Faktura (Cascade) |
| 16 | `Underhallsarende` | besiktning/service (intervall, nästa gång, status) | n-1 Fastighet (Cascade); `byggnadId` löst fält |
| 17 | `UnderhallsLogg` | åtgärdslogg | n-1 Underhallsarende (Cascade) |
| 18 | `UnderhallsDokument` | filbilaga | n-1 Underhallsarende (Cascade) |
| 19 | `Meddelande` | utskick | 1-n MeddelandeMottagare |
| 20 | `MeddelandeMottagare` | mottagare | n-1 Meddelande (Cascade); `hyresgastId` löst fält |
| 21 | `ElMatare` | elmätare | n-1 Fastighet (Cascade); `lokalId`/`byggnadId` lösa fält; 1-n ElAvlasning |
| 22 | `ElAvlasning` | mätaravläsning | n-1 ElMatare (Cascade) |
| 23 | `ElLeverantorsfaktura` | leverantörsfaktura el | n-1 Fastighet (Cascade); 1-n ElDebitering |
| 24 | `ElDebitering` | vidaredebitering/hyresgäst | n-1 ElLeverantorsfaktura (Cascade); `matareId`/`lokalId` lösa fält |
| 25 | `Lan` | lån per fastighet (ränta/amortering) | n-1 Fastighet (Cascade) |
| 26 | `Kontaktperson` | kontaktperson hos hyresgäst | n-1 Hyresgast (Cascade) |

**Unika constraints:** `User.email`, `Faktura.fakturanummer`,
`HyresavtalLokal(hyresavtalId, lokalId)`.

**"Lösa" FK-fält (String? utan relation idag)** — i Postgres bör dessa bli
riktiga FK (SetNull): `Underhallsarende.byggnadId`,
`MeddelandeMottagare.hyresgastId`, `ElMatare.lokalId`, `ElMatare.byggnadId`,
`ElDebitering.matareId`, `ElDebitering.lokalId`.

---

## 3. API-endpoints (käll-appen: 43 route.ts)

Alla använder Prisma via `@/lib/prisma`. Ingen auth. Fel → `NextResponse.json({error},{status:500})`.
Dynamiska routes: `params: Promise<{id}>` (Next 15).

**CRUD-routes (rakt-på-port):** `/api/bolag`(+`/[id]`,`/[id]/logotyp`),
`/api/fastigheter`(+`/[id]`), `/api/byggnader`(+`/[id]`), `/api/beteckningar`,
`/api/lokaler`(+`/[id]`), `/api/hyresgaster`(+`/[id]`), `/api/kontaktpersoner`,
`/api/driftskostnader`(+`/[id]`), `/api/underhall`(+`/[id]`),
`/api/meddelanden`, `/api/lan`(+`/[id]`), `/api/avtalsdokument`,
`/api/avtalsrader`, `/api/elmatare`(+`/[id]`).

**Komplexa / affärskritiska routes (rangordnade):**

| Rang | Route | Vad |
|---|---|---|
| 1 | `POST /api/fakturor` | Kvartalsfakturering: samfakturering-merge, KPI-indextillägg, kvartal vs månad, öresavrundning, dublettkontroll, fakturanummer |
| 2 | `GET /api/hyresavtal/[id]/pdf` | Hyreskontrakt A4 (Fastighetsägarna 12B.3) via **pdf-lib**, ~310 rader |
| 3 | `POST /api/el-leverantor/[id]` | El-debitering/hyresgäst: schablon vs avläsningsdiff, deleteMany+createMany |
| 4 | `GET /api/dashboard` | 8 parallella queries + tung vakans/yta-beräkning, `bolagId`-filter |
| 5 | `GET /api/statistik/kassaflode` | −24…+12 mån serie + lån-amorteringsmodell |
| 6 | `PUT /api/hyresavtal/[id]` | ~30 villkorliga fält + lokal-omkoppling + status-sync |
| 7 | `GET /api/statistik/nettoresultat` | Netto/fastighet, kr/kvm (DPI), mark exkluderad |
| 8 | `GET /api/fakturor/[id]/print` | Faktura som **HTML** (window.print), inte PDF |
| 9 | `POST /api/el-leverantor/skanna` | AI-OCR av elfaktura via `@anthropic-ai/sdk` |
| 10 | `POST /api/hyresavtal` | Avtalsnummer-gen, ~30 fält, nested lokaler + status-update |

**Externa integrationer (utan Prisma):**
- `GET /api/kpi` — SCB statistik-API (KPI totalt 1980=100), cache 24h, ingen nyckel.
- `GET /api/bolagsverket` — org.nr-lookup (mål-appen har redan `lookup-company` via apiverket → migrera INTE).
- `POST /api/el-leverantor/skanna` — Anthropic SDK (modell-id `claude-sonnet-4-6` **felaktigt** → byt till `claude-opus-4-8`).

**Filsystem-sidoeffekter (måste bli Supabase Storage):**
`/api/avtalsdokument`, `/api/bolag/[id]/logotyp`, `/api/underhall`
(dokument) — skriver idag till `public/uploads` (funkar ej på serverless).

---

## 4. Komponenter (käll-appen: 5 st)

| Komponent | Fil | Beslut |
|---|---|---|
| `SlideOver` | `ui/SlideOver.tsx` | **Porta** (guld/mörk inline-stil). Central drawer för alla formulär. |
| `BolagAutocomplete` | `ui/BolagAutocomplete.tsx` | **Porta**, men koppla mot mål-appens `lookup-company` (apiverket), ej Bolagsverket. |
| `AddressAutocomplete` | `ui/AddressAutocomplete.tsx` | **Skippa** — mål-appen har `AdressInput.tsx` (Nominatim). |
| `Header` | `layout/Header.tsx` | **Skippa** — mål-appen har `Navbar.tsx`. |
| `Sidebar` | `layout/Sidebar.tsx` | **Skippa** — annat layout-paradigm (horisontell Navbar). |

All övrig UI ligger direkt i sidornas `page.tsx`.

---

## 5. Visuellt språk — källa vs mål

| | Källa (Fastigheter) | Mål (wisboverket) |
|---|---|---|
| Metod | Tailwind v4 utility-klasser (ingen config) | **Inline `React.CSSProperties`** i varje komponent |
| Tema | Ljust, blå accent (`blue-600`) | **Mörkt, guld** `#E8C96A` på `#111/#141414/#1a1a1a` |
| Ramar | `border-gray-200/100` | `#222/#2a2a2a/#333` |
| Text | `text-gray-900/700/500` | `#f2f2f7/#e0e0e0/#888/#666` |
| Ikoner | `lucide-react` | **Emoji** (inga lucide idag) |
| Fokus | `focus:ring-blue-500` | imperativt `onFocus/onBlur` → `borderColor:#E8C96A` |
| Typografi | `text-sm/lg` (14/18px) | 12–13px, labels 11px `fontWeight:700 letterSpacing:1.2` |
| Radie | `rounded-lg` (8px) | `borderRadius: 8` (matchar) |

Delade tokens i mål: `src/components/order-tabs/shared.ts`. Fältmönster
(`inp`, `fo`, `fb`, `fmtKr`) återfinns redan inline i mål-stubbarna.

---

## 6. Dependencies & env

**Redan i mål (återanvänd):** `next` 16.2.9, `react` 19.2.4, `typescript` 5,
`@anthropic-ai/sdk` ^0.107, `@supabase/ssr`, `@supabase/supabase-js`,
Tailwind v4. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY`, `APIVERKET_API_KEY`.

**Att LÄGGA TILL i mål:**
- `pdf-lib` ^1.17.1 — hyresavtals-PDF (SAKNAS, obligatoriskt).
- `lucide-react` ^1.20.0 — **endast om** vi behåller lucide-ikoner (annars emoji → skippa).
- `clsx` + `tailwind-merge` — **endast om** vi behåller `cn()`/Tailwind i modulen (rekommenderas skippa, se PLAN.md).

**Att INTE föra över:** `@prisma/client`, `prisma`, `@prisma/adapter-libsql`,
`@libsql/client` (datalagret blir Supabase).

**Env att ev. lägga till:** `HOGIA_API_KEY` (framtida, inget kodberoende idag).
`NEXTAUTH_SECRET/URL`, `DATABASE_URL` behövs INTE (oanvända/Prisma-only).

**Config:** `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
`postcss.config.mjs` är byte-identiska mellan apparna → inget att slå ihop.

---

## 7. Sammanfattande migrerings­beroenden

| Behov | Status |
|---|---|
| `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` | Finns |
| `pdf-lib` | **Saknas — installera** |
| AI-skanning | Mål har `scan-faktura` → återanvänd mönster, byt modell-id |
| org.nr-lookup | Mål har `lookup-company` (apiverket) → migrera ej Bolagsverket |
| SCB KPI | Saknas — trivial (ingen nyckel) |
| Prisma/libSQL → Supabase | Alla 43 routes måste skrivas om (include → joins/RPC) |
| Supabase Storage | Krävs för logotyp/dokument-upload |
| Tailwind → inline styles | All UI stilas om till guld/mörk |
