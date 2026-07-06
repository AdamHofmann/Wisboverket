import type { Metadata } from 'next'
import { SITE_EMAIL, ANALYTICS_ENABLED } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Integritetspolicy – Wisboverket',
  robots: { index: false, follow: true },
}

const H2: React.CSSProperties = { fontSize: 20, fontWeight: 800, letterSpacing: '0.02em', margin: '36px 0 10px', color: '#f0f0f0' }
const P: React.CSSProperties = { fontSize: 15, lineHeight: 1.9, color: 'rgba(255,255,255,0.55)', marginBottom: 14 }
const A: React.CSSProperties = { color: '#c9a840', textDecoration: 'none' }

export default function IntegritetspolicyPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px 60px' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#c9a840', marginBottom: 14 }}>Juridik</div>
      <h1 style={{ fontSize: 'clamp(34px,5vw,48px)', fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 8 }}>Integritetspolicy</h1>
      <div style={{ width: 44, height: 2, background: '#c9a840', margin: '20px 0 28px' }} />
      <p style={{ fontSize: 13, color: '#5a5750', letterSpacing: '0.08em', marginBottom: 32 }}>Senast uppdaterad: juli 2026</p>

      <p style={P}>Wisboverket (&quot;vi&quot;, &quot;oss&quot;) värnar om din personliga integritet. Denna policy beskriver hur vi samlar in, använder och skyddar dina personuppgifter i enlighet med EU:s dataskyddsförordning (GDPR).</p>

      <h2 style={H2}>Personuppgiftsansvarig</h2>
      <p style={P}>Wisboverket<br />E-post: <a style={A} href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a><br />Telefon: <a style={A} href="tel:0705540924">070-554 09 24</a></p>

      <h2 style={H2}>Vilka uppgifter samlar vi in?</h2>
      <p style={P}>Via formulären på vår webbplats (intresseanmälan, felanmälan och kontakt) samlar vi in de uppgifter du frivilligt lämnar: namn, telefonnummer, e-postadress, uppgift om aktuellt objekt eller fastighet samt beskrivning av ditt ärende.</p>

      <h2 style={H2}>Varför samlar vi in uppgifterna?</h2>
      <p style={P}>Uppgifterna används uteslutande för att hantera din förfrågan och återkoppla till dig. Den rättsliga grunden är berättigat intresse (art. 6.1 f GDPR) samt för att fullgöra ett avtal eller vidta åtgärder inför ett avtal (art. 6.1 b GDPR).</p>

      <h2 style={H2}>Hur länge sparas uppgifterna?</h2>
      <p style={P}>Dina uppgifter sparas så länge det är nödvändigt för att hantera ärendet, och därefter i enlighet med bokföringslagens krav (7 år) om uppdraget faktureras.</p>

      <h2 style={H2}>Delas uppgifterna med tredje part?</h2>
      <p style={P}>Vi delar inte dina personuppgifter med tredje part, med undantag för tekniska tjänsteleverantörer som hanterar data för vår räkning (t.ex. Supabase för formulärhantering){ANALYTICS_ENABLED ? ', samt – om du samtycker – Google (Google Analytics och Google Ads) för besöksstatistik och annonsmätning' : ''}. Dessa är bundna av databehandlingsavtal och får inte använda uppgifterna för egna ändamål.</p>

      <h2 style={H2}>Dina rättigheter</h2>
      <p style={P}>Du har rätt att när som helst begära tillgång till, rättelse eller radering av dina uppgifter, begränsning av behandlingen samt dataportabilitet. Kontakta oss på <a style={A} href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a> för att utöva dina rättigheter.</p>

      <h2 style={H2}>Cookies</h2>
      {ANALYTICS_ENABLED ? (
        <p style={P}>Nödvändiga cookies (och ett lokalt lagringsvärde för ditt cookie-val) används alltid. Med ditt samtycke använder vi även cookies för besöksstatistik (Google Analytics) och annonsmätning (Google Ads). Inget av detta laddas innan du aktivt godkänt i cookie-rutan, och du kan när som helst neka genom att välja &quot;Endast nödvändiga&quot;. Vi tillämpar Googles Consent Mode v2, vilket innebär att inga analys- eller annonscookies sätts så länge du inte samtyckt.</p>
      ) : (
        <p style={P}>Vår webbplats använder inga spårningscookies eller analysverktyg från tredje part. Ett lokalt lagringsvärde används endast för att komma ihåg att du sett cookie-notisen.</p>
      )}

      <h2 style={H2}>Klagomål</h2>
      <p style={P}>Om du anser att vi hanterar dina uppgifter felaktigt har du rätt att lämna in ett klagomål till Integritetsskyddsmyndigheten (IMY) på <a style={A} href="https://www.imy.se" target="_blank" rel="noopener noreferrer">imy.se</a>.</p>
    </div>
  )
}
