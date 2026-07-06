# Behovsanalys — Hogia OpenBusiness-integration (underlag)

Underlag att skicka till Hogia (connect@hogia.se) / föra över till deras behovsanalys-formulär.
Fyll i **[…]**-fälten. Baserat på API-kartläggningen i `docs/hogia-integration.md`.

## 1. Kund / bolag
Integrationen ska omfatta **tre bolag** (var och en = egen Organization i Hogia Star, egna OrganizationId):

| Bolag | Org.nr | Moms.reg.nr | Hogia OpenBusiness-företag |
|---|---|---|---|
| Fastigheten IDN AB | 559488-4479 | [SE…] | [ja/konfigureras] |
| Vagnhärads Fastighets AB | 556652-6314 | [SE…] | [ja/konfigureras] |
| Wisboverket AB | 559584-2054 | [SE…] | [ja/konfigureras] |

Kontaktperson (teknisk): Adam Hofmann · [e-post] · 070-554 09 24

## 2. Integrationen
- **System vi integrerar från:** Wisboverket (egenutvecklad Next.js/Supabase-app för fastighetsförvaltning + order).
- **Hogia-system:** Hogia Open Business (Hogia Star Accounting).
- **En Application** i Developer Portal (delad API-nyckel) mot alla tre bolagen via OrganizationId.

## 3. API:er vi behöver access till (Accounting-kategorin)
| API | Riktning | Användning |
|---|---|---|
| **Contact** | Wisboverket → Hogia | Skapa/uppdatera kunder (hyresgäster) + leverantörer |
| **Article** | Wisboverket → Hogia | Synka artikelregister (bär konto för kontering) |
| **Customer Invoice** | Wisboverket → Hogia | Skapa kundfakturor (hyra, el, order); ta emot betald-status |
| **Supplier Invoice** | Hogia → Wisboverket | Hämta leverantörsfakturor (driftkostnader/kassaflöde) |
| **Accounting Setting** | Hogia → Wisboverket | Läsa kontoplan, momskoder, räkenskapsår (validering + mappning) |

## 4. Flöde & volym
- **Utgående:** kundfakturor pushas från appen (kvartals-/månadsvis hyresdebitering + el + enstaka). Uppskattad volym: **[ca X fakturor/månad]** totalt över de tre bolagen.
- **Inkommande:** leverantörsfakturor hämtas för kategorisering (driftkostnader per fastighet).
- **Betald-status:** vi vill ha realtidsuppdatering (Subscriptions) och/eller delta-poll (rowversion) så betald-status uppdateras automatiskt i appen.
- **Dimensioner:** vi vill kunna tagga fakturor per **fastighet** (ProfitCenter/CostBearer) för resultat per fastighet.

## 5. Miljö & uppstart
- **Sandbox först** för utveckling/test, sedan **produktion**.
- Vi behöver: **OrganizationId per bolag**, bekräftelse att räkenskapsår + kontoplan (försäljningskonton, kundfordringskonto, momskoder) är konfigurerade för respektive bolag.
- API-nyckel (Shared API Key) hanteras av oss i miljövariabler (aldrig i kod/repo).

## 6. Frågor till Hogia
- Får vi ett **OrganizationId per bolag** eller ett gemensamt? Hur styr vi vilket bolags bokföring ett anrop träffar?
- Finns bolagens **räkenskapsår + kontoplan** redan uppsatta i Open Business, eller ingår det i uppsättningen?
- Rekommenderad uppsättning för **e-faktura/distribution** (distributionMethodType) per kund?
- Något ytterligare avtal/DPA (databehandlaravtal) som behövs?
