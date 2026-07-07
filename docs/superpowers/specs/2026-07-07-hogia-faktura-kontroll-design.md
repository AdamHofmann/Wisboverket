# Faktura-kontroll-grind + Hogia-synk — design

**Datum:** 2026-07-07
**Status:** Godkänd design. Fas 1 byggs nu; Fas 2 väntar på Hogia-credentials.

## Bakgrund

Wisboverket skapar fakturor (hyra + el). Beslut: **Hogia OpenBusiness blir
system-of-record** för utskick och bokföring. Wisboverket skapar fakturan i Hogia
via API; Hogia skickar och bokför. Wisboverket hämtar tillbaka Hogias PDF för
support.

Grundfakta om Hogia-API:t (från gamla Order-appens `hogia-invoices.js`):
- OAuth `client_credentials` (client_id/secret/token_url, scope `openapi`).
- Endpoints under `/companies/{companyId}/invoices`: `POST` (create),
  `GET` (list), `GET /{id}` (get), `GET /{id}/pdf` (pdf).
- Radmodell: `description`, `quantity`, `unitPrice`, `vatPercent`, `articleNumber`
  — **inga custom-kolumner**. Avläsningsdata måste bakas in i `description`.
- Fältnamnen var ett TODO i gamla koden → **måste verifieras mot skarp API-spec**
  + testfaktura innan Fas 2 går live.

Vald skickmodell: **direktskickning** (skapa + skicka i ett klick) med en
**automatisk kontroll-grind** som stoppar uppenbart felaktiga fakturor — istället
för ett manuellt granskningssteg.

## Fas 1 — Kontroll-grinden (ingen Hogia-koppling)

Körs när användaren klickar **Skicka** (enskild + bulk), på alla fakturatyper.

**Modul:** `src/lib/fastigheter/fakturaKontroll.ts`
- `valideraFaktura(faktura, kontext) → { fel: string[]; varningar: string[] }`
- Ren funktion, testbar isolerat. `kontext` = övriga fakturor (för dubblett +
  historik-anomali).

**🔴 Blockerande fel (kan inte skicka):**
- Belopp ≤ 0 kr, eller fakturan saknar rader.
- El-faktura med rad där förbrukning (antal kWh) ≤ 0 eller saknas.
- Saknad mottagare (ingen hyresgäst/kund).

**🟡 Varningar (kräver "Skicka ändå?"):**
- Misstänkt dubblett: samma hyresgäst + period + typ redan i status skickad/betald.
- Anomali: el-fakturans förbrukning avviker kraftigt (t.ex. > 2× eller < 0,5×) mot
  snittet av tidigare skickade el-fakturor för samma hyresgäst — fångar felavläsning.

**UI (i `fastigheter/fakturering/page.tsx`):**
- Enskild Skicka: kör validering först. Fel → dialog listar problemen, avbryt.
  Varning → `useConfirm` "Skicka ändå?".
- Bulk Skicka: validera alla; blockerade hoppas över och rapporteras; varningar
  bekräftas samlat. Rena går igenom utan friktion.

## Fas 2 — Hogia-synk (väntar på credentials)

- **Server-route** (Next.js) ersätter gamla Netlify-funktionen. OAuth +
  `POST /companies/{id}/invoices`. Credentials i env (`HOGIA_*`), läggs in av Adam.
- **Radbeskrivning:** el-rader bakar in avläsningsdata i `description`:
  `El – Bod · avläst 2025-12-29→2026-04-07 · 56 026,63→74 681,77 kWh`.
- **Migration:** `hogia_faktura_id` + `hogia_status` på `f_faktura`.
- **Support-vy:** knapp "Visa Hogia-faktura (PDF)" → `GET .../invoices/{id}/pdf`,
  visar exakt kundens dokument.
- **Idempotens/fel:** spara `hogia_faktura_id` vid skapande; kolla det före
  ev. omsändning så vi aldrig skapar dubbletter. Fel vid Hogia-anrop → fakturan
  markeras inte skickad, felet visas, retry möjlig.

## Avgränsningar (YAGNI)
- Fas 2 byggs inte förrän skarpa Hogia-credentials + testmiljö finns.
- Ingen tvåvägs-synk av betalstatus i denna omgång (kan bli senare via `list`/`get`).
