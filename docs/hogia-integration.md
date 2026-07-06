# Hogia OpenBusiness-integration — teknisk design

Kartlagt från Hogia Developer Portal (developer.hogia.se, "Hogia Star") 2026-07-06.
Målsystem: **Hogia Open Business** (bolagens bokföring). Gäller bolagen **Fastigheten IDN AB**,
**Vagnhärads Fastighets AB** och **Wisboverket AB**.

## 1. Autentisering & kontext
- **Application** i Developer Portal = vår integration (Wisboverket-appen). Prenumererar på flera API:er under samma Application.
- **API-nyckel**: fås genom att prenumerera på ett API; för flera → "Shared API Key". Adam lägger nyckeln i `.env.local` (hanteras aldrig i klartext i chatt/kod-commits).
- **Anrop**: bas `https://connect.hogia.se/`, header **`X-Api-Key: <GUID>`**. (Ingen OAuth.)
- **OrganizationId** = organisationskontext. **Varje bolag = egen Organization** med eget OrganizationId → en Application + en delad nyckel räcker; OrganizationId styr vilket bolags bokföring anropet träffar.
- **Sandbox** finns för test (kräver OrganizationId).
- **Behovsanalys → kundspecifikt API**: Adam fyller i en behovsanalys och skickar till Hogia; de sätter upp kundspecifik access för de tre bolagen.

## 2. Accounting-API:erna (6 st, v1.0, Hogia Connect AB) och deras roll
| API | Server (bas) | Vår användning |
|---|---|---|
| **Contact** | `/accounting/v1/contact` | Push hyresgäster/kunder → få `customerNumber`; + leverantörer |
| **Article** | `/accounting/v1/article` | Synka `f_artikel` (bär konto+momskod+pris) |
| **Customer Invoice** | `/accounting/v1/customerinvoice` | Push våra fakturor; betald-status |
| **Supplier Invoice** | `/accounting/v1/supplierinvoice` | PULL lev-fakturor → kassaflöde/driftkostnader |
| **Accounting Setting** | `/accounting/v1/...` | Kontoplan, momskoder, räkenskapsår, valuta (mappningskälla + validering) |
| **Voucher** | — | Verifikat; troligen ej nödvändig steg 1 |

## 3. Synk-flöde (per bolag)
Förutsättningar (validera via Accounting Setting API): bolaget konfigurerat, **räkenskapsår** täcker fakturadatum, **valuta** (SEK) registrerad, **försäljningskonto** finns för räkenskapsåret.

```
1. Masterdata (en gång, sen vid ändring):
   hyresgäst  → Contact API  → spara hogia_kund_id (customerNumber)
   f_artikel  → Article API  → artikelnummer bär konto + momskod + pris i Hogia
2. Faktura ("Skicka" i appen):
   POST /customerinvoices  (customerNumber + invoiceLines[articleNumber+quantity])
3. Betald-status (automatiskt):
   POST /subscriptions  → Hogia notifierar vid ändring   (giltig 180 dgr, PATCH förnyar)
   och/eller GET /customerinvoices/rowversion?lastKnownRowVersion=  (delta-poll)
   → markera fakturan Betald i appen automatiskt
```

## 4. Faktura-JSON (POST /customerinvoices) + vår mappning
```json
{
  "customerInvoice": {
    "customerNumber": "<hyresgästens hogia_kund_id>",
    "invoiceDate": "<fakturadatum YYYY-MM-DD>",
    "comment": "<ev. fakturameddelande/fritext>",
    "ourReference": "<vår referens>",
    "yourReference": "<kundens referens>",
    "useRounding": true,
    "currency": { "code": "SEK" },
    "dimensions": [ { "number": "<fastighetskod>", "type": "ProfitCenter" } ],
    "project": { "number": "<valfritt>" }
  },
  "invoiceLines": [
    { "articleInvoiceLine": { "articleNumber": "<artikelkod>", "quantity": <antal> } }
  ]
}
```
**Nyckelinsikt:** raden bär bara `articleNumber` + `quantity` — **pris, konto och momskod hämtas från artikeln i Hogia** (override möjligt per rad). Därför är **artikelregistret navet**: `f_artikel` (kod, konto, momskod, apris, moms) synkas till Article API.
- **Kreditnota** = negativ `quantity` (t.ex. `-1`) + `comment`.
- **`dimensions` (ProfitCenter/CostBearer)**: tagga per **fastighet** → resultat per fastighet i Hogia. (Utnyttja våra fastighetskoder.)
- ROT-fält (`rutRot`) — ej relevant för hyresfakturor.

## 5. Vad som behöver byggas app-sidan
- **Per-bolag Hogia-inställningar**: `OrganizationId` per `f_bolag` (+ delad API-nyckel i env). Migration: `f_bolag.hogia_organization_id`.
- **Mappningar**: `f_artikel` → konto + momskod (fält finns redan); validera mot Accounting Setting (räkenskapsår-bundna konton).
- **hogia_kund_id** på hyresgäst/kund (för customerNumber). Kolumner finns delvis (order-appen Fas 1: customers.hogia_kund_id).
- **Synk-tjänst**: (a) push kund→Contact, (b) push artikel→Article, (c) "Skicka" → POST customerinvoice, (d) subscription/rowversion → betald-status, (e) pull supplierinvoice → driftkostnader.
- **Synklogg**: `hogia_synk_logg` finns (migration 019) — logga varje anrop.
- **"Skicka"-hooken** (`skickaFaktura`) är redan enda kodvägen där Hogia-pushen ska pluggas in.

## 6. Behovsanalys — vad Hogia troligen behöver (utkast)
- Organisationsnummer + företagsnamn för de tre bolagen (Fastigheten IDN AB, Vagnhärads Fastighets AB, Wisboverket AB).
- Vilket Hogia-system (Open Business) + vilka moduler.
- Vilka API:er vi ska ha access till (Contact, Article, Customer Invoice, Supplier Invoice, Accounting Setting).
- Volym (antal fakturor/mån), riktning (vi pushar kundfakturor, drar lev-fakturor).
- Sandbox- vs produktionsaccess.
*(Bekräfta mot Hogias faktiska behovsanalys-formulär när vi har det.)*

## 7. Article API — kartlagd (2026-07-06)
Server: `https://connect.hogia.se/accounting/v1/article`. Endpoints: POST `/articles` (skapa), PATCH `/articles/{id}` (uppdatera), GET `/{id}` & `/number` & `/rowversion`, Subscriptions (realtid).
**Artikel-JSON (POST /articles):**
```json
{
  "number": "<artikelkod>", "name": "<benämning>", "unit": "<st/mån>", "type": "Service",
  "salesAccounts": [ { "number": <intäktskonto>, "type": "NationalSales" } ],
  "prices": [ { "price": <apris>, "currencyCode": "SEK" } ]
}
```
- `salesAccounts` sätts **per försäljningstyp** (NationalSales / InternationalSales / EuSales / ReverseChargeSales). För oss räcker **NationalSales** (svensk hyra) = intäktskontot (t.ex. 3010).
- **INGEN momskod på artikeln** — momsen härleds från försäljningskontot i Hogias kontoplan. Vårt `f_artikel.momskod` är för vår egen visning/beräkning; till Hogia skickar vi bara kontot.
- `prices` = array per valuta (vi använder SEK).

Vår mappning: `f_artikel.kod → number`, `benamning → name`, `konto → salesAccounts[NationalSales].number`, `apris → prices[SEK].price`. Enhet/typ sätts (st/Service).

## 8. Contact API — kartlagd (2026-07-06)
Server: `https://connect.hogia.se/accounting/v1/contact`. Inga förutsättningar. Endpoints: POST `/contacts` (skapa – Organisation/Privatperson, Kund/Leverantör/båda), PATCH `/contacts/{id}`, GET `/{id}` & `/number` & `/rowversion`, Subscriptions.
**Kontakt-JSON (POST /contacts):**
```json
{
  "number": "<kundnummer>",   // → blir customerNumber på fakturan; spara som hogia_kund_id
  "countryCode": "SE",
  "addresses": [
    { "addressType": "Billing",  "street": "...", "zipCode": "...", "city": "..." },
    { "addressType": "Postal",   "street": "...", "zipCode": "...", "city": "..." },
    { "addressType": "Shipping", "street": "...", "zipCode": "...", "city": "..." }
  ]
  "contactMethods": [
    { "contactMethodType": "Phone", "contactMethodTypeValue": "..." },
    { "contactMethodType": "Email", "contactMethodTypeValue": "..." }
  ],
  "organization": {
    "name": "<bolagsnamn>", "organizationNumber": "<orgnr>", "vatNumber": "SE...",
    "customer": {
      "distribution": { "distributionMethodType": "EmailInvoice", "eInvoiceReceiverEmail": "..." },
      "paymentTerms": 10, "invoiceReference": "...", "customerDebtAccountNumber": 1511
    }
  }
  // ELLER "privatePerson": { "firstName","lastName","identificationNumber"(pnr), "customer": {...}, "rutRot": {...} }
}
```
Vår mappning: `f_hyresgast` → Contact. Företag → `organization` (namn, orgnr, vatNumber, customer). Privatperson → `privatePerson` (pnr). `number` sparas som hogia_kund_id → `customerNumber` på fakturan.
**Fält vi redan har:** `distributionMethodType`=leveranssätt (vi har `leveranssatt`), `paymentTerms`=betalningsvillkor (`betalvillkor`), `organizationNumber`=orgnr, `vatNumber`=momsreg.nr, `customerDebtAccountNumber`=kundfordringskonto (t.ex. 1511).

## 11. Lägga till ett nytt bolag i integrationen
När ett nytt bolag (ny Organization) ska omfattas — följ i ordning. **Ny Application behövs inte**: samma Application + delade API-nyckel täcker flera Organizations; nya bolaget får bara eget `OrganizationId`.

**A. Hos Hogia**
1. Bolaget finns som eget företag i Open Business med bokföringen uppsatt (räkenskapsår, kontoplan, försäljningskonton, kundfordringskonto t.ex. 1511, momskoder).
2. Kontakta Hogia (connect@hogia.se): koppla nya Organizationen till vår **befintliga Application** → få **OrganizationId**.
3. Uppdatera vid behov behovsunderlaget + kontrollera att **PUB-avtalet** täcker bolagets personuppgifter.

**B. I appen**
4. Skapa/kontrollera bolaget (`f_bolag`): namn, org.nr, momsreg.nr, adress, bankgiro/plusgiro, dröjsmålsränta.
5. Spara `OrganizationId` → `f_bolag.hogia_organization_id`.
6. Validera via Accounting Setting API: räkenskapsår täcker datum, försäljnings-/kundfordrings-konton + momskoder finns.
7. Synka masterdata: artiklar (`f_artikel`) → Article API; hyresgäster på bolagets avtal (`f_hyresgast`) → Contact API → spara `hogia_kund_id`.

**C. Test & drift**
8. Sandbox: testfaktura `POST /customerinvoices` med bolagets OrganizationId → verifiera konto/moms/avsändare.
9. Aktivera Subscriptions (eller rowversion-poll) för betald-status.
10. (Valfritt) pull av leverantörsfakturor.
11. Produktion när skarp faktura verifierats.

**Checklista:** ☐ bokföring i Hogia ☐ OrganizationId ☐ PUB-avtal ☐ `f_bolag.hogia_organization_id` ☐ konton/räkenskapsår validerade ☐ artiklar synkade ☐ hyresgäster synkade ☐ testfaktura OK ☐ betald-status flödar.

## 9. Status: kartläggning KLAR
Alla fyra kärn-API:er kartlagda (Contact, Article, Customer Invoice + Accounting Setting-beroenden). Redo för: (a) behovsanalys-utkast, (b) app-sidans Hogia-modul (Fas 1, byggs utan nyckel). Ev. detaljfält (kontaktperson, line-override) hämtas ur "Components/Schemas" vid bygget. Bolagens faktiska kontoplan + räkenskapsår hämtas via Accounting Setting API när nyckeln finns.
