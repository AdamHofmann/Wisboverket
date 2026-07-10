# Spec: Live Push-to-Talk (walkie-talkie) för Wisboverket

_Status: planerad (eget spår, byggs senare). Skapad 2026-07-10._

## Mål
Realtids röstkommunikation i teamet — håll in en knapp, prata, övriga hör dig
direkt (som en walkie-talkie). Tänkt användning: Adam/Isabelle på kontoret +
personal ute på jobb, snabb röst istället för att ringa/skriva.

## Val av transport
**WebRTC via LiveKit** (rekommenderat).
- Managed **LiveKit Cloud** (gratis-tier räcker för småteam) — kan self-hostas senare.
- Bra SDK för web + fungerar i Capacitor-webvyn (WebRTC + `getUserMedia`).
- SFU (server-mixad) → skalar bättre än peer-to-peer när fler än 2 är med.
- Alternativ: **Agora** (också enkelt, bra free-tier). Twilio dyrare. Supabase
  Realtime räcker bara till signalering, inte själva ljudet.

## Arkitektur
- **Rum = kanal.** MVP: ett gemensamt företags-rum. Senare: ett rum per bolag.
- **Token-utgivning:** Supabase **Edge Function** `livekit-token` — inloggad
  användare → returnerar en signerad LiveKit-access-token (mintad med LiveKit
  API key + secret som Supabase-secrets). Klienten joinar rummet med tokenen.
  (Token-mintning skriver inget i DB → blockeras INTE av skriv-incidenten.)
- **Klient:** LiveKit-SDK (WebRTC). Joina rummet, prenumerera på övrigas ljud
  (auto-play). Håll knappen → publicera mic; släpp → muta.
- **Presence + "vem pratar":** via LiveKit (active speakers + deltagarlista).

## UX
- **PTT-vy / flytande knapp:** stor "HÅLL FÖR ATT PRATA"-knapp.
- Lista över **vem som är online** i kanalen + **vem som pratar just nu** (lyser upp).
- Enkel indikator: ansluten / frånkopplad.
- Ljud spelas upp automatiskt när någon pratar (om appen är öppen / se Fas 2).

## Native / behörigheter
- **Mikrofon:** `NSMicrophoneUsageDescription` i Info.plist → **native-ändring =
  ny App Store-build** (samma typ av steg som push).
- **Bakgrundsljud (Fas 2):** för att höra när appen ligger i bakgrunden krävs
  Background Modes → Audio. MVP körs i förgrunden (appen öppen).

## Faser
**Fas 1 (MVP):**
- Ett gemensamt företags-rum, förgrunds-PTT.
- Håll-för-att-prata, vem-är-online + vem-pratar.
- LiveKit Cloud free-tier, Edge Function för token.

**Fas 2:**
- Rum per bolag (välj kanal).
- Bakgrundsljud (hör även när appen är minimerad).
- **"Någon kallar"-push** via OneSignal (öppnar appen till kanalen) — bygger på
  push-setupen. Se [minnet: Supabase att göra].
- Floor control (kö — bara en talar i taget, äkta walkie-talkie-känsla).

## Styr med knappen på headset/hörselkåpor (hands-free)
Mål: trycka på knappen på Bluetooth-kåporna (svara-/mediaknappen) för att prata —
utan att ta upp telefonen.

- **Går att göra**, men med en nyans: Bluetooth-kåpor skickar **diskreta
  knapptryck** (play/pause/answer) till iOS, inte "håll nedtryckt"-läge. Så det
  blir realistiskt en **toggle** — tryck = prata på, tryck igen = av — snarare än
  äkta håll-för-att-prata.
- **Teknik:** appen fångar mediaknappen via **MPRemoteCommandCenter** (iOS native)
  → mappar play/pause till PTT-toggle. Kräver en **native-plugin** (webbens
  MediaSession-API är för ostabilt i WKWebView för det här). Appen registrerar
  sig som "now playing"-app så knappen når oss.
- **Bäst känsla:** dedikerade **PTT-headset/kåpor** (t.ex. 3M Peltor WS/LiteCom,
  Sena) med en riktig PTT-knapp — vissa har äkta håll-funktion. Värt att välja
  hårdvara med det i åtanke om hands-free är viktigt.
- **Placering:** Fas 2/3 (efter att grund-PTT funkar), ihop med bakgrundsljud så
  det funkar med appen minimerad.

## Att sätta upp (senare)
- **LiveKit-konto** → API key + secret → Supabase-secrets.
- **Mic-permission + ny iOS-build** (native).
- Edge Function `livekit-token` deployad.
- (Fas 2) OneSignal-push för "någon kallar".

## Beroenden / öppna frågor
- Kräver INTE att skriv-incidenten är löst (token-mintning + WebRTC skriver ej i DB).
- Kostnad: LiveKit Cloud free-tier räcker långt; kolla minuter/deltagare-gräns
  innan skarp drift.
- Beslut senare: en gemensam kanal vs per-bolag från start; floor control eller
  fri överlappning.
