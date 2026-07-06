# Cutover-checklista — hofmannsab.se → wisboverket.se

Domän-, hosting- och namnbyte för Wisboverket. Uppdaterad 2026-07-06.

**Upplägg:** hemsida + system är EN Next.js-app som driftsätts på **Vercel** (via GitHub-push, inte FileZilla). Loopia = bara domän/DNS + e-post. Domän/e-post styrs från `src/lib/site.ts` (env-mall i `.env.example`), så bytet är en env-ändring.

## Fas 0 — Förutsättningar (gaterar allt)
- [ ] Namnet Wisboverket godkänt hos Bolagsverket
- [ ] Org.nr för Wisboverket AB erhållet
- [x] Domänen wisboverket.se köpt (Loopia)

## Fas 1 — Konton & förberedelse (kan göras innan namnet är klart)
- [ ] Vercel-konto skapat, GitHub-repot `AdamHofmann/Wisboverket` kopplat
- [ ] Miljövariabler i Vercel: Supabase-nycklar (service role = hemlig, läggs in av Adam) + `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_EMAIL`, `MAIL_FROM`, `PUBLIC_FORM_ORIGIN`
- [ ] Första testdeploy till `*.vercel.app` verifierad (produktionsbygget är redan bekräftat rent lokalt)
- [ ] GA4-property skapad → `G-XXXXXXXXXX`
- [ ] Google Ads-konto + konverteringsåtgärder → `AW-XXXXXXXXX`, länkat till GA4

## Fas 2 — Microsoft 365 e-post (befintlig tenant)
- [ ] wisboverket.se tillagd som domän i M365 Admin Center
- [ ] DNS hos Loopia: verifierings-TXT + MX, SPF, DKIM, DMARC, autodiscover
- [ ] Postlådor: `info@wisboverket.se` (+ ev. `adam@`, `noreply@`)
- [ ] `info@hofmannsab.se` som alias på nya lådan

## Fas 3 — Cutover-dagen
- [ ] Sätt env i Vercel till wisboverket-värden (SITE_URL, SITE_EMAIL, MAIL_FROM, PUBLIC_FORM_ORIGIN, GA_ID, ADS_ID)
- [ ] Lägg till wisboverket.se som domän i Vercel
- [ ] Peka Loopia-DNS (A/CNAME) mot Vercel → SSL auto, verifiera https
- [ ] Uppdatera Supabase auth redirect-URL:er
- [ ] 301-redirect hofmannsab.se → wisboverket.se (behåll gamla domänen för SEO)
- [ ] Verifiera: hemsida, inloggning, formulär → Inkorg, robots/sitemap, GA4-data, testkonvertering i Ads

## Fas 4 — Efterarbete
- [ ] Google Search Console: verifiera domän, skicka sitemap, begär omindexering
- [ ] Uppdatera Google Business Profile, sociala medier, tryckt material
- [ ] **Koppla bort Loopia-FTP / FileZilla** — hosting sker nu på Vercel, ingen manuell uppladdning
- [ ] Avsluta gamla Netlify-demon (när som helst, kolla billing)
- [ ] **Stäng ner Firebase — SISTA steget** (se varning)

> ⚠️ **Firebase sist:** nuvarande live-sajt fångar leads via Firebase. Stäng inte förrän nya sajten är live + verifierad. Ordning: exportera gamla leads → bekräfta nya formulär landar i Inkorgen → radera projektet + avsluta ev. Blaze-billing.

**Kostnadskoll:** endast aktiva betalplaner kostar. Kolla billing på Firebase (Blaze) + Netlify innan avslut.
