'use client'

import { useEffect, useRef, useState } from 'react'
import type { Hyresobjekt } from '@/types'
import { SITE_EMAIL } from '@/lib/site'
import { trackConversion } from '@/lib/analytics'

// ── Kategori / prioritet: DB-värden är ASCII-normaliserade ──
const KAT_LABEL: Record<string, string> = {
  el: 'El ⚡',
  vvs: 'VVS 🔧',
  snickeri: 'Snickeri 🪚',
  stad: 'Städ 🧹',
  las: 'Lås & Säkerhet 🔒',
  annat: 'Annat 📋',
}
const PRIO_LABEL: Record<string, string> = {
  lag: 'Låg',
  normal: 'Normal',
  hog: 'Hög',
  akut: '🚨 Akut',
}

function fmtSek(n: number) {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function HemPage() {
  // ── Uthyrning ──
  const [objekt, setObjekt] = useState<Hyresobjekt[]>([])
  const [aktivtObjekt, setAktivtObjekt] = useState<Hyresobjekt | null>(null)
  const [galleriBild, setGalleriBild] = useState<string | null>(null)
  const [uthSkickat, setUthSkickat] = useState(false)
  const [uthForm, setUthForm] = useState({ namn: '', telefon: '', epost: '', meddelande: '' })

  // ── Felanmälan wizard ──
  const [faStep, setFaStep] = useState(1) // 1..3, 4 = success
  const [faErr, setFaErr] = useState('')
  const [faKat, setFaKat] = useState<string | null>(null)
  const [faPrio, setFaPrio] = useState('normal')
  const [faRef, setFaRef] = useState('')
  const [faSubmitting, setFaSubmitting] = useState(false)
  const [faData, setFaData] = useState({
    namn: '',
    email: '',
    telefon: '',
    fastighet: '',
    lagenhet: '',
    beskrivning: '',
  })

  const navRef = useRef<HTMLElement>(null)

  // ── Nav scroll-effekt ──
  useEffect(() => {
    const onScroll = () => {
      navRef.current?.classList.toggle('scrolled', window.scrollY > 50)
    }
    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  })

  // ── IntersectionObserver reveal ──
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible')
        })
      },
      { threshold: 0.1 }
    )
    document.querySelectorAll('.hab .reveal').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [objekt])

  // ── Hämta uthyrningsobjekt ──
  useEffect(() => {
    fetch('/api/public/uthyrning')
      .then((r) => r.json())
      .then((json) => {
        const data: Hyresobjekt[] = Array.isArray(json?.data) ? json.data : []
        setObjekt(data)
      })
      .catch(() => setObjekt([]))
  }, [])

  // ── Escape stänger modal ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const filtrerade = objekt

  function openModal(o: Hyresobjekt) {
    setAktivtObjekt(o)
    const bilder = Array.isArray(o.bilder) ? o.bilder.filter(Boolean) : []
    setGalleriBild(bilder[0] || null)
    setUthSkickat(false)
    setUthForm({ namn: '', telefon: '', epost: '', meddelande: '' })
    document.body.style.overflow = 'hidden'
  }
  function closeModal() {
    setAktivtObjekt(null)
    document.body.style.overflow = ''
  }

  async function submitUth(e: React.FormEvent) {
    e.preventDefault()
    if (!aktivtObjekt) return
    try {
      await fetch('/api/public/forfragan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typ: 'uthyrning',
          namn: uthForm.namn.trim(),
          telefon: uthForm.telefon.trim(),
          epost: uthForm.epost.trim() || null,
          meddelande: uthForm.meddelande.trim() || null,
          objekt_titel: aktivtObjekt.titel || null,
          fastighet: aktivtObjekt.fastighet || null,
        }),
      })
    } catch {
      /* visa success ändå – best effort som originalet */
    }
    setUthSkickat(true)
    trackConversion('intresseanmalan', { objekt: aktivtObjekt.titel || null })
  }

  // ── Felanmälan steg-navigering ──
  function faNext(s: number) {
    setFaErr('')
    if (s === 1) {
      if (!faData.namn.trim()) return setFaErr('Ange ditt namn.')
      if (!faData.email.trim() || !faData.email.includes('@'))
        return setFaErr('Ange en giltig e-postadress.')
      if (!faData.fastighet.trim())
        return setFaErr('Ange vilken fastighet felet gäller.')
    }
    if (s === 2) {
      if (!faKat) return setFaErr('Välj en kategori.')
      if (!faData.beskrivning.trim()) return setFaErr('Beskriv felet.')
    }
    setFaStep(s + 1)
    document
      .getElementById('felanmalan')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function faBack(s: number) {
    setFaErr('')
    setFaStep(s - 1)
  }

  async function faSubmit() {
    setFaErr('')
    setFaSubmitting(true)
    try {
      const res = await fetch('/api/public/felanmalan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namn: faData.namn.trim(),
          epost: faData.email.trim(),
          telefon: faData.telefon.trim() || null,
          fastighet: faData.fastighet.trim() || null,
          lagenhet: faData.lagenhet.trim() || null,
          kategori: faKat,
          prioritet: faPrio,
          beskrivning: faData.beskrivning.trim(),
        }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json().catch(() => null)
      setFaRef(data?.nummer ? 'FA-' + data.nummer : 'FA-' + Date.now().toString(36).toUpperCase().slice(-6))
      setFaStep(4)
      trackConversion('felanmalan', { kategori: faKat, prioritet: faPrio })
    } catch {
      setFaErr(
        'Något gick fel. Försök igen eller ring oss direkt på 070-554 09 24.'
      )
      setFaSubmitting(false)
    }
  }

  const faProgress = faStep >= 4 ? 100 : { 1: 33, 2: 66, 3: 100 }[faStep] || 33
  const faProgressLabel = faStep >= 4 ? 'Klart!' : `Steg ${faStep} av 3`

  const modalBilder = aktivtObjekt
    ? (Array.isArray(aktivtObjekt.bilder) ? aktivtObjekt.bilder.filter(Boolean) : [])
    : []

  return (
    <>
      {/* NAV */}
      <nav id="mainNav" ref={navRef}>
        <ul className="nav-links">
          <li>
            <a href="#om-oss">Om oss</a>
          </li>
          <li className="has-dropdown">
            <a href="#tjanster">Tjänster</a>
            <ul className="dropdown">
              <li><a href="#tjanster">Utemiljö & Grönyta</a></li>
              <li><a href="#tjanster">Löpande Underhåll</a></li>
              <li><a href="#tjanster">Reparationer</a></li>
              <li><a href="#tjanster">Vinter & Sommar</a></li>
              <li><a href="#tjanster">Månatlig Rondering</a></li>
              <li><a href="#tjanster">Skräddarsydda Lösningar</a></li>
            </ul>
          </li>
          <li><a href="#uthyrning">Uthyrning</a></li>
          <li><a href="#kontakt">Kontakt</a></li>
        </ul>
        <a href="#felanmalan" className="nav-cta">Felanmälan</a>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid"></div>
        <div className="hero-glow"></div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Wisboverket logotyp – Fastighet och Skötsel i Södermanland"
          className="hero-logo"
        />

        <p className="hero-sub">Södermanland &nbsp;·&nbsp; Sverige</p>

        <div className="hero-cta">
          <a href="#tjanster" className="btn-gold">Våra tjänster</a>
          <a href="#felanmalan" className="btn-outline">Felanmälan</a>
        </div>

        <div className="scroll-indicator">
          <span>Scroll</span>
          <div className="scroll-mouse"><div className="scroll-wheel"></div></div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          <span>Fastighetsservice</span><span className="marquee-dot">◆</span>
          <span>Utemiljö</span><span className="marquee-dot">◆</span>
          <span>Rondering</span><span className="marquee-dot">◆</span>
          <span>Underhåll</span><span className="marquee-dot">◆</span>
          <span>Städning</span><span className="marquee-dot">◆</span>
          <span>Reparationer</span><span className="marquee-dot">◆</span>
          <span>Södermanland</span><span className="marquee-dot">◆</span>
          <span>Fastighetsservice</span><span className="marquee-dot">◆</span>
          <span>Utemiljö</span><span className="marquee-dot">◆</span>
          <span>Rondering</span><span className="marquee-dot">◆</span>
          <span>Underhåll</span><span className="marquee-dot">◆</span>
          <span>Städning</span><span className="marquee-dot">◆</span>
          <span>Reparationer</span><span className="marquee-dot">◆</span>
          <span>Södermanland</span><span className="marquee-dot">◆</span>
        </div>
      </div>

      {/* OM OSS */}
      <section className="about" id="om-oss">
        <div className="about-inner">
          <div className="reveal">
            <span className="section-label">Om oss</span>
            <h2 className="section-title">Vi gör det ordentligt</h2>
            <div className="gold-line"></div>
            <p>Njut av ledigheten och lämna fastighetsskötseln till oss! Vi kan ta hand om din fastighet löpande eller vid specifika tillfällen. Vi tar hand om allt löpande underhåll eller gör punktinsatser. Allt ifrån gräsklippning, ommålning, enkla rutinuppgifter till månatliga kontroller för att du ska kunna njuta av din fritid.</p>
            <br />
            <p>Våra underhållstjänster inkluderar allt från mindre reparationer till löpande rondering utifrån ditt behov. Med en välvårdad ute- och inomhusmiljö ökar du attraktionskraften för hela din fastighet. Vi är flexibla och kan erbjuda ett brett utbud av skräddarskydda lösningar som säkerställer att din fastighet underhålls och ser välskött ut året om.</p>
            <br />
            <p>Självklart följer vi upp och har en nära dialog med dig så att du tryggt kan följa arbetet på distans.</p>
            <br />
            <p>Wisboverket är ett familjeägt bolag grundat 2026. Vi är ett dedikerat, punktligt och effektivt team som arbetar både förebyggande och reaktivt.</p>
            <p>Du följer enkelt arbetet med nära dialog och regelbunden uppföljning.</p>
            <div className="about-quote">&quot;Du fokuserar på kärnverksamheten – vi sköter resten.&quot;</div>
            <div style={{ marginTop: 36 }}>
              <a href="tel:0705540924" className="btn-gold">Ring oss</a>
            </div>
          </div>
          <div className="about-cards reveal reveal-d1">
            <div className="about-card">
              <div className="about-card-top">
                <span className="about-card-icon">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="2,14 14,3 26,14" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><rect x="5" y="14" width="18" height="12" stroke="#E8C96A" strokeWidth="1.4" strokeLinejoin="round" /><rect x="11" y="20" width="6" height="6" stroke="#E8C96A" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                </span>
                <h3>Familjeägt & dedikerat</h3>
              </div>
              <p>Vi är ett litet team med stort hjärta. Varje uppdrag behandlas med samma omsorg som om det vore vår egen fastighet.</p>
            </div>
            <div className="about-card">
              <div className="about-card-top">
                <span className="about-card-icon">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="#E8C96A" strokeWidth="1.4" /><line x1="18" y1="18" x2="25" y2="25" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" /><polyline points="9,12 11.5,14.5 16,10" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <h3>Förebyggande</h3>
              </div>
              <p>Vi identifierar problem innan de eskalerar och sparar er tid och pengar på sikt.</p>
            </div>
            <div className="about-card">
              <div className="about-card-top">
                <span className="about-card-icon">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="16,2 8,15 14,15 12,26 20,13 14,13 16,2" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <h3>På plats när det gäller</h3>
              </div>
              <p>Uppstår något akut är vi snabbt på plats och löser problemet effektivt.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TJÄNSTER */}
      <section className="services" id="tjanster">
        <div className="services-inner">
          <div className="services-header reveal">
            <span className="section-label">Vad vi gör</span>
            <h2 className="section-title">Våra tjänster</h2>
          </div>
          <div className="services-grid">
            <div className="service-card reveal">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 20, display: 'block' }}>
                <path d="M18 32C18 32 7 25 7 14C7 8.5 11.5 5 18 5C24.5 5 29 8.5 29 14C29 25 18 32 18 32Z" stroke="#E8C96A" strokeWidth="1.4" strokeLinejoin="round" />
                <line x1="18" y1="32" x2="18" y2="16" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M18 22C18 22 13 19 10.5 15.5" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M18 19C18 19 22 17 24 14" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <h3>Utemiljö & Grönyta</h3>
              <p>Gräsklippning, häckklippning, ogräsrensning, vår- och höststädning samt säsongsplantering för en välvårdad fastighet hela året.</p>
            </div>
            <div className="service-card reveal reveal-d1">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 20, display: 'block' }}>
                <path d="M27 9.5C24.5 7 21 5.5 18 5.5C11 5.5 5.5 11 5.5 18" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M9 26.5C11.5 29 15 30.5 18 30.5C25 30.5 30.5 25 30.5 18" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <polyline points="27,5.5 27,9.5 23,9.5" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="9,30.5 9,26.5 13,26.5" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="18" y1="12" x2="18" y2="18" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="18" y1="18" x2="22" y2="21" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <h3>Löpande Underhåll</h3>
              <p>Avläsningar, byte av lampor, enklare montering, rengöring av entréer och parkeringsplatser samt bortforsling av avfall.</p>
            </div>
            <div className="service-card reveal reveal-d2">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 20, display: 'block' }}>
                <circle cx="16" cy="16" r="10" stroke="#E8C96A" strokeWidth="1.4" />
                <line x1="23" y1="23" x2="30.5" y2="30.5" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <polyline points="11,16 14.5,19.5 21,13" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3>Månatlig Rondering</h3>
              <p>Regelbunden kontroll av din fastighet. Vi hjälper dig att tidigt upptäcka skador, säkerhetsrisker eller fel.</p>
            </div>
            <div className="service-card reveal">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 20, display: 'block' }}>
                <path d="M30 8C30 8 27.5 5.5 24 7L26.5 10L25.5 11L22.5 9C21 12.5 22.5 16.5 25 17.5L10.5 30C9.5 31 10.5 32 11.5 32L24.5 19.5C28 20.5 31.5 18.5 32 15.5L29 13.5L30 12.5L32.5 15C33.5 11.5 32 8.5 30 7" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="6" y1="28" x2="9" y2="31" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <h3>Reparationer</h3>
              <p>Allt från mindre reparationer till uppfräschning efter tidigare hyresgäst – såväl inne som ute.</p>
            </div>
            <div className="service-card reveal reveal-d1">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 20, display: 'block' }}>
                <line x1="18" y1="5" x2="18" y2="31" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="5" y1="18" x2="31" y2="18" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="8.5" y1="8.5" x2="27.5" y2="27.5" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="27.5" y1="8.5" x2="8.5" y2="27.5" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="18" y1="5" x2="15" y2="8" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="18" y1="5" x2="21" y2="8" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="18" y1="31" x2="15" y2="28" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="18" y1="31" x2="21" y2="28" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="5" y1="18" x2="8" y2="15" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="5" y1="18" x2="8" y2="21" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="31" y1="18" x2="28" y2="15" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="31" y1="18" x2="28" y2="21" stroke="#E8C96A" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <h3>Vinter & Sommar</h3>
              <p>Snöröjning, halkbekämpning, sommarplantering och allt däremellan – vi anpassar oss efter årstiderna.</p>
            </div>
            <div className="service-card reveal reveal-d2">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 20, display: 'block' }}>
                <polygon points="18,4 22,14 33,14 24,21 27,31 18,25 9,31 12,21 3,14 14,14" stroke="#E8C96A" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <h3>Skräddarsydda Lösningar</h3>
              <p>Har du speciella önskemål? Vi är flexibla och utformar ett paket som passar just din fastighet.</p>
            </div>
          </div>
        </div>
      </section>

      {/* UTHYRNING */}
      <section className="uthyrning" id="uthyrning" style={{ padding: '80px 0', background: 'var(--dark2)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
          <div className="reveal" style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="section-label">Uthyrning</span>
            <h2 className="section-title">Lediga objekt</h2>
            <p style={{ color: 'rgba(245,242,237,0.75)', fontSize: 16, maxWidth: 520, margin: '12px auto 0' }}>
              Lokaler i Södermanland och Mälardalen. Hör av dig så berättar vi mer.
            </p>
          </div>

          {/* Grid */}
          {filtrerade.length > 0 ? (
            <div
              id="uth-grid"
              style={
                filtrerade.length === 1
                  ? { display: 'grid', gridTemplateColumns: 'minmax(300px,380px)', justifyContent: 'center', gap: 20 }
                  : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }
              }
            >
              {filtrerade.map((o) => (
                <div
                  key={o.id}
                  className="uth-card"
                  onClick={() => openModal(o)}
                  role="article"
                  aria-label={o.titel || 'Hyresobjekt'}
                >
                  <div className="uth-card-img">
                    {o.bilder && o.bilder[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.bilder[0]} alt={`${o.titel || ''} – ${o.fastighet || ''}`} loading="lazy" />
                    ) : (
                      '🏠'
                    )}
                    {o.tillganglig_fran ? (
                      <div className="uth-avail-badge">Tillgänglig {o.tillganglig_fran}</div>
                    ) : null}
                  </div>
                  <div className="uth-card-body">
                    <div className="uth-typ">{o.typ || 'objekt'}</div>
                    <div className="uth-card-title">{o.titel || '—'}</div>
                    <div className="uth-card-addr">📍 {o.fastighet || '—'}</div>
                    <div className="uth-card-stats">
                      <div className="uth-card-stat">
                        <div className="uth-card-stat-label">Yta</div>
                        <div className="uth-card-stat-value">{o.total_yta ? o.total_yta + ' kvm' : '—'}</div>
                      </div>
                      <div className="uth-card-stat">
                        <div className="uth-card-stat-label">Hyra / mån</div>
                        <div className="uth-card-stat-value gold">{o.hyra ? fmtSek(o.hyra) : '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div id="uth-empty" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
              <p style={{ fontSize: 16 }}>
                Inga lediga objekt just nu.
                <br />
                Kontakta oss så hittar vi något för dig.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Uthyrning Modal */}
      {aktivtObjekt && (
        <div
          id="uth-modal"
          style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 400, alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: 'var(--dark3)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{aktivtObjekt.titel || '—'}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {galleriBild && (
                <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: modalBilder.length > 1 ? 6 : 16 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={galleriBild} alt={aktivtObjekt.titel || ''} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} loading="lazy" />
                </div>
              )}
              {modalBilder.length > 1 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16 }}>
                  {modalBilder.slice(1).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={aktivtObjekt.titel || ''}
                      style={{ height: 72, width: 96, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', flexShrink: 0, border: '1px solid var(--border)' }}
                      onClick={() => setGalleriBild(src)}
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
              <div className="uth-modal-stat"><span>Typ</span><span>{aktivtObjekt.typ ? aktivtObjekt.typ.charAt(0).toUpperCase() + aktivtObjekt.typ.slice(1) : '—'}</span></div>
              <div className="uth-modal-stat"><span>Adress</span><span>{aktivtObjekt.fastighet || '—'}</span></div>
              {aktivtObjekt.total_yta ? (
                <div className="uth-modal-stat"><span>Yta</span><span>{aktivtObjekt.total_yta} kvm</span></div>
              ) : null}
              <div className="uth-modal-stat"><span>Hyra / mån</span><span style={{ color: 'var(--gold)', fontSize: 16, fontWeight: 700 }}>{aktivtObjekt.hyra ? fmtSek(aktivtObjekt.hyra) : '—'}</span></div>
              {aktivtObjekt.tillganglig_fran ? (
                <div className="uth-modal-stat"><span>Tillgänglig från</span><span>{aktivtObjekt.tillganglig_fran}</span></div>
              ) : null}
              {(aktivtObjekt.beskrivning || aktivtObjekt.kort_beskrivning) ? (
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, margin: '16px 0 0' }}>
                  {aktivtObjekt.beskrivning || aktivtObjekt.kort_beskrivning}
                </p>
              ) : null}

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 12 }}>
                  Intresseanmälan
                </div>
                {uthSkickat ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#81c784', fontWeight: 700, fontSize: 15 }}>
                    ✓ Tack! Vi hör av oss inom kort.
                  </div>
                ) : (
                  <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={submitUth}>
                    <input className="uth-form-input" type="text" placeholder="Ditt namn" required autoComplete="name" value={uthForm.namn} onChange={(e) => setUthForm({ ...uthForm, namn: e.target.value })} />
                    <input className="uth-form-input" type="tel" placeholder="Telefonnummer" required autoComplete="tel" value={uthForm.telefon} onChange={(e) => setUthForm({ ...uthForm, telefon: e.target.value })} />
                    <input className="uth-form-input" type="email" placeholder="E-postadress (valfritt)" autoComplete="email" value={uthForm.epost} onChange={(e) => setUthForm({ ...uthForm, epost: e.target.value })} />
                    <textarea className="uth-form-input" placeholder="Meddelande (valfritt)" rows={3} style={{ resize: 'vertical' }} value={uthForm.meddelande} onChange={(e) => setUthForm({ ...uthForm, meddelande: e.target.value })} />
                    <button type="submit" style={{ padding: 13, background: 'var(--gold)', color: 'var(--black)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Skicka intresseanmälan
                    </button>
                  </form>
                )}
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <a href="tel:0705540924" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>📞 Ring oss direkt: 070-554 09 24</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FELANMÄLAN */}
      <section className="report" id="felanmalan">
        <div className="report-inner">
          <div className="fa-card">
            <div className="fa-header">
              <h3>Felanmälan</h3>
              <p>Fyll i formuläret så hanterar vi ditt ärende så snart som möjligt.</p>
              <div className="fa-progress-wrap"><div className="fa-progress-bar" style={{ width: faProgress + '%' }}></div></div>
              <div className="fa-progress-label">{faProgressLabel}</div>
            </div>
            <div className="fa-body">
              {faErr && <div className="fa-error visible">{faErr}</div>}

              {/* Steg 1 */}
              <div className={'fa-step' + (faStep === 1 ? ' active' : '')}>
                <div className="fa-step-title">Kontaktuppgifter</div>
                <div className="fa-step-sub">Så vi kan återkoppla till dig.</div>
                <div className="fa-field">
                  <label>Namn <span className="req">*</span></label>
                  <input type="text" placeholder="Förnamn Efternamn" value={faData.namn} onChange={(e) => setFaData({ ...faData, namn: e.target.value })} />
                </div>
                <div className="fa-row2">
                  <div className="fa-field">
                    <label>E-post <span className="req">*</span></label>
                    <input type="email" placeholder="din@email.se" value={faData.email} onChange={(e) => setFaData({ ...faData, email: e.target.value })} />
                  </div>
                  <div className="fa-field">
                    <label>Telefon</label>
                    <input type="tel" placeholder="070-000 00 00" value={faData.telefon} onChange={(e) => setFaData({ ...faData, telefon: e.target.value })} />
                  </div>
                </div>
                <div className="fa-row2">
                  <div className="fa-field">
                    <label>Fastighet <span className="req">*</span></label>
                    <input type="text" placeholder="t.ex. Storgatan 12B" value={faData.fastighet} onChange={(e) => setFaData({ ...faData, fastighet: e.target.value })} />
                  </div>
                  <div className="fa-field">
                    <label>Lägenhet / Lokal</label>
                    <input type="text" placeholder="t.ex. Lgh 301" value={faData.lagenhet} onChange={(e) => setFaData({ ...faData, lagenhet: e.target.value })} />
                  </div>
                </div>
                <div className="fa-nav">
                  <button className="fa-btn-next" onClick={() => faNext(1)}>Fortsätt →</button>
                </div>
              </div>

              {/* Steg 2 */}
              <div className={'fa-step' + (faStep === 2 ? ' active' : '')}>
                <div className="fa-step-title">Beskriv felet</div>
                <div className="fa-step-sub">Välj kategori och beskriv vad som hänt.</div>
                <div className="fa-field">
                  <label>Kategori <span className="req">*</span></label>
                  <div className="fa-kat-grid">
                    {([
                      ['el', '⚡', 'El'],
                      ['vvs', '🔧', 'VVS'],
                      ['snickeri', '🪚', 'Snickeri'],
                      ['stad', '🧹', 'Städ'],
                      ['las', '🔒', 'Lås & Säkerhet'],
                      ['annat', '📋', 'Annat'],
                    ] as [string, string, string][]).map(([val, ikon, label]) => (
                      <button
                        key={val}
                        type="button"
                        className={'fa-kat-btn' + (faKat === val ? ' selected' : '')}
                        onClick={() => setFaKat(val)}
                      >
                        <span className="ki">{ikon}</span>
                        <span className="kl">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fa-field" style={{ marginTop: 16 }}>
                  <label>Beskrivning <span className="req">*</span></label>
                  <textarea placeholder="Beskriv felet så detaljerat som möjligt..." value={faData.beskrivning} onChange={(e) => setFaData({ ...faData, beskrivning: e.target.value })} />
                </div>
                <div className="fa-field">
                  <label>Prioritet</label>
                  <div className="fa-prio-row">
                    {([
                      ['lag', 'Låg'],
                      ['normal', 'Normal'],
                      ['hog', 'Hög'],
                      ['akut', '🚨 Akut'],
                    ] as [string, string][]).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        data-val={val}
                        className={'fa-prio-btn' + (faPrio === val ? ' selected' : '')}
                        onClick={() => setFaPrio(val)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="fa-hint">Välj &quot;Akut&quot; endast vid direkt fara eller stor skada (t.ex. vattenläcka, inbrott).</div>
                </div>
                <div className="fa-nav">
                  <button className="fa-btn-back" onClick={() => faBack(2)}>← Tillbaka</button>
                  <button className="fa-btn-next" onClick={() => faNext(2)}>Granska →</button>
                </div>
              </div>

              {/* Steg 3 */}
              <div className={'fa-step' + (faStep === 3 ? ' active' : '')}>
                <div className="fa-step-title">Granska & skicka</div>
                <div className="fa-step-sub">Kontrollera att allt stämmer.</div>
                <div className="fa-summary">
                  <div><strong>Namn</strong>{faData.namn}</div>
                  <div><strong>E-post</strong>{faData.email}</div>
                  <div><strong>Telefon</strong>{faData.telefon || '—'}</div>
                  <div><strong>Fastighet</strong>{faData.fastighet}</div>
                  <div><strong>Lägenhet</strong>{faData.lagenhet || '—'}</div>
                  <div><strong>Kategori</strong>{(faKat && KAT_LABEL[faKat]) || faKat}</div>
                  <div><strong>Prioritet</strong>{PRIO_LABEL[faPrio]}</div>
                  <div><strong>Beskrivning</strong>{faData.beskrivning}</div>
                </div>
                <div className="fa-hint">Genom att skicka in godkänner du att vi behandlar dina uppgifter för att hantera ärendet.</div>
                <div className="fa-nav">
                  <button className="fa-btn-back" onClick={() => faBack(3)}>← Ändra</button>
                  <button className="fa-btn-next" disabled={faSubmitting} onClick={faSubmit}>
                    {faSubmitting ? 'Skickar…' : 'Skicka felanmälan ✓'}
                  </button>
                </div>
              </div>

              {/* Success */}
              <div className={'fa-success' + (faStep === 4 ? ' active' : '')}>
                <div className="fa-success-icon">✅</div>
                <h3>Felanmälan mottagen!</h3>
                <p>Tack! Vi har tagit emot din anmälan och återkommer inom kort.<br />Du får en bekräftelse via e-post.</p>
                <div className="fa-ref">{faRef ? 'Referensnummer: ' + faRef : ''}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KONTAKT */}
      <section className="contact" id="kontakt">
        <div className="contact-inner">
          <div className="reveal">
            <span className="section-label">Kontakt</span>
            <h2 className="section-title">Hör av dig</h2>
            <div className="gold-line"></div>
            <div className="contact-item">
              <span className="ci-label">Telefon</span>
              <span className="ci-val"><a href="tel:0705540924">070-554 09 24</a></span>
            </div>
            <div className="contact-item">
              <span className="ci-label">E-post</span>
              <span className="ci-val"><a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a></span>
            </div>
            <a href="tel:0705540924" className="btn-gold" style={{ marginTop: 8, display: 'inline-flex' }}>Ring oss</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">WISBOVERKET</div>
        <p>
          © 2026 Wisboverket · Södermanland ·{' '}
          <a href="/integritetspolicy" style={{ color: 'var(--gold)', opacity: 0.6, textDecoration: 'none' }}>Integritetspolicy</a>
        </p>
        <nav style={{ position: 'static', height: 'auto', padding: 0, background: 'none', border: 'none', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <a href="#om-oss" style={{ color: 'rgba(245,242,237,0.4)', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Om oss</a>
          <a href="#tjanster" style={{ color: 'rgba(245,242,237,0.4)', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tjänster</a>
          <a href="#felanmalan" style={{ color: 'rgba(245,242,237,0.4)', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Felanmälan</a>
          <a href="#kontakt" style={{ color: 'rgba(245,242,237,0.4)', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Kontakt</a>
        </nav>
      </footer>
    </>
  )
}
