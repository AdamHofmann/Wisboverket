# PLAN — Migrera Fastigheter-appen in i Order-appen (wisboverket)

Konkret migrationsplan. Läs INVENTORY.md och SCHEMA.sql först.

## 0. Utgångsläge & övergripande beslut

Mål-appen har en **halvfärdig, trasig** fastighets-ansats (se INVENTORY.md §0):
14 engelska tabeller i `001_initial_schema.sql`, 4 stub-sidor som importerar en
icke-existerande `@/types` och frågar mot en mix av tabeller (varav några inte
finns). Det engelska schemat är dessutom en kraftig **förenkling** av käll-appens
26 modeller (saknar ~12 tabeller och de flesta fält: index, samfakturering, el-
debitering, lån, avtalsdokument, PDF-relevanta avtalsfält osv.).

**Beslut:**
1. **Nytt, käll-troget schema med `f_`-prefix** (SCHEMA.sql →
   `015_fastigheter_full.sql`). Samexisterar med 001-tabellerna utan
   namnkrock. Detta ger full paritet med käll-appen från dag ett.
2. **Ersätt de 4 stub-sidorna** — de är trasiga och täcker bara en delmängd.
   Porta käll-appens 12 sidor i stället, kopplade mot `f_`-tabellerna.
3. **001:s engelska fastighets-tabeller lämnas orörda men deprekeras** (de är
   tomma i praktiken; ingen kod skriver till dem som fungerar). Ta INTE bort dem
   i denna migration — en separat städ-migration kan droppa dem senare när det
   är verifierat att inget beror på dem.
4. **Datalager: behåll Next route handlers**, men byt Prisma → Supabase
   **server-klient** (`@/lib/supabase/server`). Motivering i §2.

---

## 1. Fil-för-fil-karta (källa → mål)

Föreslagen struktur i mål:
- Sidor: `src/app/(app)/fastigheter/**` (nästlade under befintlig `(app)`-grupp så Navbar/layout ärvs).
- Delade komponenter: `src/components/fastigheter/**`.
- API-routes: `src/app/api/fastigheter/**` (namespacade under `fastigheter/` för att undvika krock med befintliga `/api/*`).
- Hjälpare/affärslogik: `src/lib/fastigheter/**`.

### 1a. Sidor

| Källa | Mål | Not |
|---|---|---|
| `src/app/page.tsx` (Dashboard) | `src/app/(app)/fastigheter/page.tsx` | Modulens startsida. **Ersätt den befintliga trasiga stubben.** |
| `src/app/fastigheter/page.tsx` | `src/app/(app)/fastigheter/objekt/page.tsx` | "fastigheter" i källan = objektlistan. Byt route-namn för att inte krocka med modulroten. |
| `src/app/lokaler/page.tsx` | `src/app/(app)/fastigheter/lokaler/page.tsx` | |
| `src/app/hyresgaster/page.tsx` | `src/app/(app)/fastigheter/hyresgaster/page.tsx` | **Ersätt befintlig stub** `src/app/(app)/hyresgaster/page.tsx` (flytta hit + ta bort gamla). |
| `src/app/hyresavtal/page.tsx` | `src/app/(app)/fastigheter/hyresavtal/page.tsx` | **Ersätt befintlig stub** `src/app/(app)/hyresavtal/page.tsx`. |
| `src/app/driftskostnader/page.tsx` | `src/app/(app)/fastigheter/driftskostnader/page.tsx` | |
| `src/app/elmatare/page.tsx` | `src/app/(app)/fastigheter/elmatare/page.tsx` | |
| `src/app/fakturering/page.tsx` | `src/app/(app)/fastigheter/fakturering/page.tsx` | **Namnkrock:** mål har redan `/fakturering` (order-fakturor). Lägg hyres-fakturering under `/fastigheter/fakturering`. |
| `src/app/ekonomi/page.tsx` | `src/app/(app)/fastigheter/ekonomi/page.tsx` | |
| `src/app/underhall/page.tsx` | `src/app/(app)/fastigheter/underhall/page.tsx` | **Ersätt befintlig stub** `src/app/(app)/underhall/page.tsx`. |
| `src/app/kommunikation/page.tsx` | `src/app/(app)/fastigheter/kommunikation/page.tsx` | |
| `src/app/installningar/page.tsx` | `src/app/(app)/fastigheter/installningar/page.tsx` | Bolagsregister. |

> Ta bort de fyra befintliga stubbarna
> `src/app/(app)/{hyresavtal,hyresgaster,underhall}/page.tsx` och den gamla
> `src/app/(app)/fastigheter/page.tsx` när ersättningarna är på plats. Kontrollera
> att inget annat i mål-appen länkar till toppnivå-`/hyresavtal` etc. (Navbar gör
> det inte idag; endast `/fastigheter` finns där.)

### 1b. Komponenter

| Källa | Mål | Beslut |
|---|---|---|
| `components/ui/SlideOver.tsx` | `src/components/fastigheter/SlideOver.tsx` | **Porta**, guld/mörk inline-stil. |
| `components/ui/BolagAutocomplete.tsx` | `src/components/fastigheter/BolagAutocomplete.tsx` | **Porta**, koppla mot `/api/lookup-company` (apiverket), inte Bolagsverket. |
| `components/ui/AddressAutocomplete.tsx` | — | **Skippa.** Använd befintlig `src/components/AdressInput.tsx`. |
| `components/layout/Header.tsx` | — | **Skippa.** Mål har `Navbar.tsx`. |
| `components/layout/Sidebar.tsx` | — | **Skippa.** Ersätts av sub-nav (§3). |
| `context/BolagContext.tsx` | `src/components/fastigheter/BolagContext.tsx` | **Porta.** Byt `fetch('/api/bolag')` → Supabase-query mot `f_bolag`. Behåll `localStorage['valtBolagId']`. Wrappa endast fastighets-subträdet (se §3). |
| `lib/utils.ts` (`cn()`) | — | **Skippa** om Tailwind ej används i modulen (se §4). |

### 1c. API-routes

| Källa | Mål | Portning |
|---|---|---|
| `api/bolag`, `api/bolag/[id]` | `api/fastigheter/bolag[/[id]]` | Prisma→Supabase CRUD |
| `api/bolag/[id]/logotyp` | `api/fastigheter/bolag/[id]/logotyp` | `fs.writeFile` → **Supabase Storage** |
| `api/fastigheter`, `/[id]` | `api/fastigheter/objekt[/[id]]` | CRUD + nested beteckningar |
| `api/byggnader`, `/[id]` | `api/fastigheter/byggnader[/[id]]` | CRUD |
| `api/beteckningar` | `api/fastigheter/beteckningar` | CRUD |
| `api/lokaler`, `/[id]` | `api/fastigheter/lokaler[/[id]]` | djup select |
| `api/hyresgaster`, `/[id]` | `api/fastigheter/hyresgaster[/[id]]` | CRUD |
| `api/kontaktpersoner` | `api/fastigheter/kontaktpersoner` | CRUD |
| `api/hyresavtal`, `/[id]` | `api/fastigheter/hyresavtal[/[id]]` | komplex; junction-omkoppling |
| `api/hyresavtal/[id]/pdf` | `api/fastigheter/hyresavtal/[id]/pdf` | **pdf-lib** + logga |
| `api/avtalsdokument` | `api/fastigheter/avtalsdokument` | + Storage |
| `api/avtalsrader` | `api/fastigheter/avtalsrader` | CRUD |
| `api/indexhojningar`, `/[id]` | `api/fastigheter/indexhojningar[/[id]]` | **RPC/transaktion** |
| `api/driftskostnader`, `/[id]` | `api/fastigheter/driftskostnader[/[id]]` | CRUD |
| `api/fakturor`, `/[id]` | `api/fastigheter/fakturor[/[id]]` | **tyngst** — affärslogik |
| `api/fakturor/[id]/print` | `api/fastigheter/fakturor/[id]/print` | HTML + logga |
| `api/underhall`, `/[id]` | `api/fastigheter/underhall[/[id]]` | CRUD + logg |
| `api/meddelanden` | `api/fastigheter/meddelanden` | CRUD |
| `api/elmatare`, `/[id]` | `api/fastigheter/elmatare[/[id]]` | CRUD + avläsning |
| `api/el-leverantor`, `/[id]` | `api/fastigheter/el-leverantor[/[id]]` | debiteringsberäkning |
| `api/el-leverantor/skanna` | `api/fastigheter/el-leverantor/skanna` | Anthropic; **byt modell-id till `claude-opus-4-8`** |
| `api/lan`, `/[id]` | `api/fastigheter/lan[/[id]]` | CRUD |
| `api/dashboard` | `api/fastigheter/dashboard` | parallella queries |
| `api/statistik/*` | `api/fastigheter/statistik/*` | ren beräkning + Supabase |
| `api/kpi` | `src/lib/fastigheter/kpi.ts` (funktion) **+** `api/fastigheter/kpi` (route) | Exponera KPI-hämtningen som funktion så `fakturor` kan anropa direkt utan intern `fetch`. |
| `api/bolagsverket` | — | **Skippa.** Använd `/api/lookup-company`. |

### 1d. Affärslogik-hjälpare (bryt ut ur routes för testbarhet)

| Ny fil i mål | Innehåll (från källa) |
|---|---|
| `src/lib/fastigheter/kpi.ts` | SCB-hämtning (från `api/kpi`) som ren funktion |
| `src/lib/fastigheter/fakturering.ts` | kvartals-/index-/samfaktura-/öreslogik (från `api/fakturor`) |
| `src/lib/fastigheter/eldebitering.ts` | schablon/avläsning (från `api/el-leverantor/[id]`) |
| `src/lib/fastigheter/lan.ts` | `lanBetalningarPerManad()` amorteringsmodell |
| `src/lib/fastigheter/pdf-hyresavtal.ts` | pdf-lib-bygget |

---

## 2. Datalager-port: Prisma → Supabase

**Rekommendation: behåll Next.js route handlers**, byt bara ut Prisma-klienten
mot Supabase **server-klienten** (`@/lib/supabase/server`, respekterar RLS via
användarens session-cookie).

**Varför route handlers (och inte flytta allt till client-side supabase):**
1. **Affärslogiken kräver server.** Fakturagenerering, PDF (pdf-lib), AI-skanning,
   SCB-fetch och lån-amortering hör hemma på servern. Att flytta till klienten
   skulle exponera logik och krångla till Storage/AI-nycklar.
2. **Minsta möjliga omskrivning.** Route-signaturerna och UI:ts `fetch('/api/...')`
   kan behållas nästan orört — bara sökvägen ändras till `/api/fastigheter/...`.
   Prisma-anropen inuti byts ut men kontraktet mot UI:t är detsamma.
3. **Konsekvent med mål-appen.** Mål-appen använder redan route handlers för
   server-tunga saker (`scan-faktura`, `lookup-company`, `ai-meddelande`,
   `send-sms`) och client-side supabase för enkel CRUD i sidorna. Följ det:
   **enkel läsning i sidorna kan gå direkt via `@/lib/supabase/client`**, medan
   de komplexa routes behålls som handlers. Så en pragmatisk hybrid:
   - Enkel lista/CRUD (fastigheter, lokaler, hyresgäster, driftskostnader, lån,
     underhåll) → **direkt client-side supabase i sidan** (matchar mål-appens
     befintliga stub-mönster, ex. `fastigheter/page.tsx` som redan gör
     `sb.from('...').select()`), ELLER behåll som route om du föredrar ett ställe.
   - Komplext (fakturor, pdf, el-debitering, dashboard-aggregat, statistik,
     index-batch, AI-skanning) → **behåll som route handler** med server-klient.

### Före/efter — representativ CRUD-route (`GET/POST /api/lokaler`)

**FÖRE (källa, Prisma):**
```ts
// src/app/api/lokaler/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const lokaler = await prisma.lokal.findMany({
    include: {
      fastighet: { include: { bolag: true, byggnader: true } },
      byggnad: true,
      hyresavtalLokaler: {
        include: { hyresavtal: { include: { hyresgast: true } } },
        where: { hyresavtal: { status: { in: ['aktiv', 'uppsagd'] } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(lokaler)
}

export async function POST(req: Request) {
  const body = await req.json()
  const lokal = await prisma.lokal.create({ data: body })
  return NextResponse.json(lokal)
}
```

**EFTER (mål, Supabase server-klient):**
```ts
// src/app/api/fastigheter/lokaler/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const sb = await createClient()
  // Nästlad include → PostgREST embedded resources.
  const { data, error } = await sb
    .from('f_lokal')
    .select(`
      *,
      fastighet:f_fastighet ( *, bolag:f_bolag(*), byggnader:f_byggnad(*) ),
      byggnad:f_byggnad(*),
      avtal:f_hyresavtal_lokal (
        hyresavtal:f_hyresavtal ( *, hyresgast:f_hyresgast(*) )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtret "endast aktiv/uppsagd avtal" görs i JS efter hämtning
  // (PostgREST kan inte filtrera på djupt nästlad relation i samma select lika enkelt).
  const filtered = (data ?? []).map(l => ({
    ...l,
    avtal: (l.avtal ?? []).filter((a: any) =>
      ['aktiv', 'uppsagd'].includes(a.hyresavtal?.status)),
  }))
  return NextResponse.json(filtered)
}

export async function POST(req: Request) {
  const sb = await createClient()
  const body = await req.json()
  const { data, error } = await sb.from('f_lokal').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### Före/efter — nested write med transaktion (`POST /api/indexhojningar`)

Prisma-loopen (create indexhojning + update bashyra per avtal) är
**transaktionslös** i källan. I Supabase gör vi den **atomär via RPC**:

**EFTER — Postgres-funktion (lägg i migration eller SCHEMA-tillägg):**
```sql
create or replace function f_apply_indexhojning(p_avtal_ids text[], p_procent numeric, p_skapad_av text)
returns void language plpgsql security invoker as $$
declare a record;
begin
  for a in select id, bashyra from f_hyresavtal where id = any(p_avtal_ids) loop
    insert into f_indexhojning (id, hyresavtal_id, datum, kpi_gammal, kpi_ny, procent,
                                bashyra_gammal, bashyra_ny, skapad_av)
    values (gen_random_uuid()::text, a.id, now(), 0, 0, p_procent,
            a.bashyra, round(a.bashyra * (1 + p_procent/100.0), 2), p_skapad_av);
    update f_hyresavtal set bashyra = round(bashyra * (1 + p_procent/100.0), 2) where id = a.id;
  end loop;
end $$;
```
**Route:**
```ts
const sb = await createClient()
const { error } = await sb.rpc('f_apply_indexhojning', {
  p_avtal_ids: avtalIds, p_procent: procent, p_skapad_av: 'Admin',
})
```
Samma RPC-mönster gäller för `POST /api/fakturor` (multi-step create+merge+delete)
och `POST /api/el-leverantor/[id]` (deleteMany+createMany) — kandidater för
Postgres-funktioner för atomicitet.

### Mönster för `include` → PostgREST
- `include: { rel: true }` → `.select('*, rel:tabell(*)')`
- `_count` → separat `select('id', { count: 'exact', head: true })` eller vy.
- `aggregate({ _sum })` → Postgres-vy/RPC eller `select` + JS-summering.
- nested `create` → `insert` av parent, sedan `insert` av barn med FK; helst RPC om atomicitet krävs.
- `updateMany`/`deleteMany` → `.update(...).in('id', ids)` / `.delete().in(...)`.

---

## 3. Navigation — knapp uppe till höger + /fastigheter

Mål-appens skal:
- `src/app/(app)/layout.tsx` renderar `<Navbar/>` + `<main>`.
- `src/components/Navbar.tsx` = horisontell sticky topbar med `ORDER_LINKS`,
  guld-accent `#E8C96A`, `spacer` + "Logga ut"-knapp längst till höger (rad 87–88).

**Uppgift:** en knapp "uppe till höger" som växlar in i Fastigheter-modulen.

**Implementering (minimal, matchar befintligt mönster):**
1. Ta bort `/fastigheter` ur `ORDER_LINKS` (rad 14) — den ska inte ligga bland
   order-flikarna utan vara en egen modul-växlare till höger.
2. Lägg en modulväxlare i `spacer`-området, före "Logga ut" (Navbar rad ~87):
```tsx
<div style={S.spacer} />
<Link
  href="/fastigheter"
  style={{
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    background: pathname.startsWith('/fastigheter') ? '#E8C96A' : 'transparent',
    color: pathname.startsWith('/fastigheter') ? '#000' : '#E8C96A',
    border: '1px solid #E8C96A', textDecoration: 'none', marginRight: 12,
    whiteSpace: 'nowrap',
  }}
>
  🏢 Fastigheter
</Link>
<button onClick={handleLogout} style={S.logoutBtn}>Logga ut</button>
```
3. **Sub-navigation för fastighets-modulen.** Eftersom modulen har 12 egna
   sidor, lägg en egen layout `src/app/(app)/fastigheter/layout.tsx` som:
   - wrappar barnen i `<BolagProvider>` (porterad context, se §1b),
   - renderar en horisontell sub-flikrad (samma stil som Navbar men egna länkar:
     Översikt / Fastigheter / Lokaler / Hyresgäster / Hyresavtal / Driftskostnader
     / Elmätare / Fakturering / Ekonomi / Underhåll / Kommunikation / Inställningar),
   - renderar käll-appens **bolag-switch** (från `Header.tsx`) i sub-navens
     högerkant, driven av `useBolag()`.
   Detta bevarar käll-appens UX (meny + bolagsväxlare) utan att röra global Navbar.

   `layout.tsx` (skiss):
```tsx
'use client'
import { BolagProvider } from '@/components/fastigheter/BolagContext'
import FastigheterSubnav from '@/components/fastigheter/Subnav'
export default function FastigheterLayout({ children }: { children: React.ReactNode }) {
  return (
    <BolagProvider>
      <FastigheterSubnav />
      <div style={{ marginTop: 12 }}>{children}</div>
    </BolagProvider>
  )
}
```

**Netto:** Order-appens Navbar behåller order-flikarna; en guldknapp "🏢
Fastigheter" uppe till höger tar in i modulen; modulen har sin egen sub-nav +
bolagsväxlare. Global layout och auth-middleware ärvs automatiskt via `(app)`.

---

## 4. Visuell portering

**Rekommendation: portera FULLT till mål-appens inline-style/guld-mörk-konvention.
Behåll INTE Tailwind isolerat för modulen.**

Motiv:
- Mål-appen använder inga Tailwind-klasser i komponenter; att införa dem enbart
  för fastighets-modulen ger två parallella stilsystem och inkonsekvent tema.
- Käll-appens ljusa/blå tema krockar visuellt med mål-appens mörka/guld — måste
  ändå omstämmas färg-för-färg, så vinsten med att behålla Tailwind är noll.
- Stub-sidorna i mål visar redan exakt det inline-mönster som ska följas
  (`inp`, `fo`, `fb`, `fmtKr`, S-objekt).

**Konkret arbete per portad fil:**
1. `className="..."` (Tailwind) → `style={{ ...S.x }}` inline-objekt. Bygg en delad
   token-fil `src/components/fastigheter/styles.ts` (färger, `inp`, `btn`, `label`,
   `card`, `fo/fb`) — utöka mönstret från `src/components/order-tabs/shared.ts`.
2. Färg-remap (använd denna tabell):
   | Källa | Mål |
   |---|---|
   | `bg-blue-600` / primär | `#E8C96A` bg + `#000` text |
   | `text-blue-600` | `#E8C96A` |
   | `focus:ring-blue-500` | `onFocus`→`borderColor:#E8C96A` (`fo`), `onBlur`→`#2a2a2a` (`fb`) |
   | `bg-white` | `#1a1a1a` |
   | `bg-gray-50` (fält) | `#111` |
   | `border-gray-200/100` | `#2a2a2a` / `#333` |
   | `text-gray-900/700` | `#f2f2f7` / `#e0e0e0` |
   | `text-gray-500/400` | `#888` / `#666` |
   | backdrop `bg-black/30` | `rgba(0,0,0,0.7)` |
3. **Ikoner: byt lucide → emoji** för att matcha mål-appens konvention
   (`🏢 📄 ⚡ 🔧 👥 🧾 📊 ✉️ ⚙️` osv.). Då slipper vi lägga till `lucide-react`,
   `clsx`, `tailwind-merge` och `lib/utils.ts`. (Alternativ: inför lucide om
   Adam föredrar rena ikoner — men det bryter nuvarande emoji-linje; default = emoji.)
4. Typografi: labels → `fontSize:11, fontWeight:700, letterSpacing:1.2` (versaler);
   fält/UI → 12–13px; `borderRadius: 8`.
5. `SlideOver` → behåll drawer-mönstret men mörk/guld (backdrop `rgba(0,0,0,0.7)`,
   panel `#1a1a1a`, border `#222`). Alternativt konvertera till mål-appens
   centrerade modal (`NyOrderModal`-stil) — men drawer är bättre för de långa
   avtalsformulären, så **behåll drawer**.

---

## 5. Dependencies & env

**Lägg till i `package.json`:**
- `pdf-lib` ^1.17.1 — obligatoriskt (hyresavtals-PDF).
- (Ingen `lucide-react` / `clsx` / `tailwind-merge` om emoji-vägen väljs enligt §4.)

**Kör:** `npm i pdf-lib`

**Env (mål `.env.local`):**
- `ANTHROPIC_API_KEY` — finns redan (återanvänd för el-skanning).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — finns.
- `APIVERKET_API_KEY` — finns (för `lookup-company` i BolagAutocomplete).
- SCB-KPI kräver ingen nyckel.
- (Valfritt framtida: `HOGIA_API_KEY`.)
- **Behövs INTE:** `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (Prisma/legacy).

**Storage:** skapa bucket `fastigheter` (privat) med policies enligt
`014_order_bilder_storage.sql`-mönstret för logotyp + avtals-/underhållsdokument.

---

## 6. Risker & öppna frågor

| # | Risk / fråga | Hantering |
|---|---|---|
| R1 | **Befintligt engelskt 001-schema + trasiga stubbar.** Namn- och route-konflikt. | Nytt `f_`-prefixat schema; ersätt stubbarna; lämna 001-tabeller orörda (droppa senare). Kräver bekräftelse att 001-fastighetstabellerna är tomma/oanvända i prod. |
| R2 | **Auth.** Käll-appen har ingen auth ("Admin" hårdkodad). Mål har Supabase Auth + middleware. | Modulen ärver `(app)`-skyddet automatiskt. Ersätt käll-appens `skapadAv:'Admin'` med inloggad användares namn/e-post från Supabase-sessionen. |
| R3 | **RLS.** Alla `f_`-tabeller kör "authenticated får allt". | OK för internt bruk. Ingen anon-läsning (till skillnad från `hyresobjekt`). Skärp senare vid behov. |
| R4 | **PDF server-side.** `pdf-lib` + å/ä/ö med `StandardFonts.Helvetica` ger dålig teckenrendering. Loggan (minnesregel) ska in. | Bädda in en TTF med svenska tecken (`pdf.embedFont` + `fontkit`) ELLER acceptera Helvetica-begränsningen initialt. Bädda in Wisboverket-loggan via `embedPng` från Storage. |
| R5 | **Transaktioner.** Fakturagenerering/index/el-debitering är multi-step. | Gör atomära via Postgres-RPC (§2). Prio: `fakturor` (störst risk för halvskapade rader). |
| R6 | **Öresavrundning & samfakturering** i `POST /fakturor` är affärskritisk. | Bryt ut till `lib/fastigheter/fakturering.ts` och skriv enhetstester mot kända in/ut-värden innan produktion. |
| R7 | **Modell-id `claude-sonnet-4-6`** i el-skanning är felaktigt. | Byt till `claude-opus-4-8` (som mål-appens `scan-faktura`). |
| R8 | **Seed/data-migrering.** `prisma/dev.db` innehåller utvecklingsdata (cuid-PK). | Om Adams riktiga data ligger i Turso: exportera per tabell → transformera kolumnnamn till `f_`-schemat → `insert`. Behåll text-PK (cuid) vid import. Om bara dev-data: seeda om från grunden. **Öppen fråga: var ligger produktionsdatan?** |
| R9 | **Bolagsverket vs apiverket.** Två org.nr-källor. | Migrera ej Bolagsverket; koppla BolagAutocomplete mot `/api/lookup-company`. Verifiera att apiverket-svaret har fälten BolagAutocomplete behöver. |
| R10 | **`/fakturering`-namnkrock.** Mål har order-fakturering; källan hyres-fakturering. | Hyres-fakturering läggs under `/fastigheter/fakturering`. Inget krock. |
| R11 | **`orders.fastighet_id` saknas** men gamla stubben joinar mot det. | Om order↔fastighet-koppling önskas: separat migration som lägger `fastighet_id text references f_fastighet(id)` på `orders`. Öppen fråga: ska ordrar knytas till fastigheter? (Stubben antyder ja.) |
| R12 | **`messages` vs `f_meddelande`.** 001 har redan `messages`. | Käll-appens meddelanden → `f_meddelande`(+mottagare). Låt 001:s `messages` vara. |

---

## 7. Exekverings-checklista (för nästa workflow)

### Steg 3 — FLYTT (infrastruktur + port)
- [ ] 3.1 `npm i pdf-lib` i wisboverket.
- [ ] 3.2 Kör `SCHEMA.sql` som `supabase/migrations/015_fastigheter_full.sql` mot Supabase. Verifiera 25 `f_`-tabeller + RLS-policies skapade.
- [ ] 3.3 Skapa Storage-bucket `fastigheter` (privat) + policies (mönster: 014).
- [ ] 3.4 Porta `BolagContext` → `src/components/fastigheter/BolagContext.tsx` (Supabase-query mot `f_bolag`).
- [ ] 3.5 Skapa `src/components/fastigheter/styles.ts` (delade guld/mörk-tokens).
- [ ] 3.6 Porta `SlideOver` + `BolagAutocomplete` (inline-stil, emoji).
- [ ] 3.7 Skapa `src/app/(app)/fastigheter/layout.tsx` (BolagProvider + Subnav + bolagsväxlare).
- [ ] 3.8 Uppdatera `Navbar.tsx`: ta bort `/fastigheter` ur `ORDER_LINKS`, lägg guldknapp "🏢 Fastigheter" till höger.
- [ ] 3.9 Porta affärslogik-hjälpare till `src/lib/fastigheter/` (kpi, fakturering, eldebitering, lan, pdf-hyresavtal).
- [ ] 3.10 Skapa Postgres-RPC:er för atomära operationer (index, fakturor, el-debitering).
- [ ] 3.11 Porta de 12 sidorna → `src/app/(app)/fastigheter/**` (inline-stil, emoji, `fetch('/api/fastigheter/...')` eller client-side supabase).
- [ ] 3.12 Porta de ~40 API-routes → `src/app/api/fastigheter/**` (Prisma→Supabase server-klient). Byt el-skanning-modell till `claude-opus-4-8`. Koppla BolagAutocomplete → `lookup-company`.
- [ ] 3.13 Ta bort de 4 trasiga stubbarna (`(app)/{fastigheter,hyresavtal,hyresgaster,underhall}/page.tsx`) när ersättning finns.
- [ ] 3.14 `npm run build` — noll TS/lint-fel.

### Steg 4 — PARITET (funktionell verifiering mot källan)
- [ ] 4.1 CRUD fungerar för: bolag, fastighet, byggnad, beteckning, lokal, hyresgäst, kontaktperson, hyresavtal, driftskostnad, underhåll, lån, elmätare.
- [ ] 4.2 Hyresavtal: skapa avtal → lokal-status → 'uthyrd'; säg upp → slutdatum beräknas.
- [ ] 4.3 Fakturagenerering: kvartal vs månad, samfakturering-merge, KPI-index, öresavrundning, dublettspärr, fakturanummer unikt.
- [ ] 4.4 Hyresavtals-PDF genereras (med logga + svenska tecken).
- [ ] 4.5 Faktura-print (HTML) genereras med logga.
- [ ] 4.6 El-debitering: schablon + avläsningsdiff ger rätt belopp/hyresgäst.
- [ ] 4.7 AI-skanning av elfaktura returnerar korrekt JSON.
- [ ] 4.8 Dashboard-KPI:er + statistik (nettoresultat, kassaflöde m. lån-amortering) matchar käll-appens värden på samma indata.
- [ ] 4.9 Index-batchhöjning uppdaterar bashyra + loggar historik atomärt.
- [ ] 4.10 Bolagsväxlare filtrerar korrekt över alla sidor; `localStorage` persist.
- [ ] 4.11 Kommunikation: skapa meddelande + mottagare (e-postutskick var TODO i källan — verifiera paritet, inte ny funktion).
- [ ] 4.12 Logotyp/dokument-upload → Supabase Storage, publik URL fungerar.

### Steg 5 — BUGGHUNT
- [ ] 5.1 RLS: verifiera att utloggad ej når `f_`-tabeller; inloggad når allt.
- [ ] 5.2 FK/onDelete: radera fastighet → cascade lokaler/byggnader; radera byggnad → lokal.byggnad_id blir null.
- [ ] 5.3 Transaktions-RPC:er: framtvinga fel mitt i → ingen halvskapad state.
- [ ] 5.4 Numerisk precision: belopp `numeric(14,2)`, ingen float-drift i summeringar/moms.
- [ ] 5.5 Datum/tidszon: `timestamptz` vs `date` — avtal start/slut, förfallodagar.
- [ ] 5.6 Inga döda länkar till gamla toppnivå-routes (`/hyresavtal` etc.).
- [ ] 5.7 Namnkrockar: `messages`/`f_meddelande`, `/fakturering`-routes åtskilda.
- [ ] 5.8 PDF svenska tecken (å/ä/ö) renderas korrekt.
- [ ] 5.9 `npm run build` + manuell rök-test av alla 12 sidor.
- [ ] 5.10 /code-review på hela diffen.
