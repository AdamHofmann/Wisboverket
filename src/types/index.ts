export type Profile = {
  id: string
  namn: string
  epost: string | null
  roll: 'admin' | 'användare'
  modul_order: boolean
  modul_fastighet: boolean
  created_at: string
}

export type Customer = {
  id: string
  namn: string
  typ: 'privat' | 'företag'
  epost: string | null
  fakturamail: string | null
  telefon: string | null
  adress: string | null
  postnummer: string | null
  ort: string | null
  orgnummer: string | null
  betalvillkor: number | null
  anteckningar: string | null
  leveranssatt: 'brev' | 'epost' | 'peppol'
  peppol_id: string | null
  hogia_kund_id: string | null
  hogia_synkad_at: string | null
  created_at: string
  updated_at: string
}

export type Contact = {
  id: string
  customer_id: string
  namn: string
  roll: string | null
  telefon: string | null
  epost: string | null
  created_at: string
}

export type Supplier = {
  id: string
  namn: string
  typ: string | null
  telefon: string | null
  epost: string | null
  adress: string | null
  orgnummer: string | null
  anteckningar: string | null
  created_at: string
}

export type Article = {
  id: string
  artikelnummer: string | null
  namn: string
  beskrivning: string | null
  pris: number
  enhet: string
  moms_procent: number
  bokforing_konto: string | null
  konto: string | null
  momssats: number
  hogia_artikel_id: string | null
  hogia_synkad_at: string | null
  aktiv: boolean
  created_at: string
}

export type Order = {
  id: string
  order_number: string | null
  titel: string
  kategori: string | null
  status: 'ny' | 'pågående' | 'klar' | 'inaktiv'
  customer_id: string | null
  fastighet: string | null
  postnummer: string | null
  ort: string | null
  bokad_datum: string | null
  bokad_datum_till: string | null
  bokad_start: string | null
  bokad_slut: string | null
  tilldelad: string[] | null
  beskrivning: string | null
  intern_anteckning: string | null
  prioritet: string | null
  fakturareferens: string | null
  fakturerat: boolean
  fakturerat_belopp: number | null
  fakturadatum: string | null
  aterkommande: string | null
  lagenhet: string | null
  kanal: string | null
  kontakt_namn: string | null
  kontakt_telefon: string | null
  kontakt_epost: string | null
  utford_datum: string | null
  faktureras_inte: boolean
  pris: number | null
  offert_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  customer?: Customer
}

export type Offer = {
  id: string
  offer_number: string | null
  customer_id: string | null
  order_id: string | null
  status: 'utkast' | 'skickad' | 'accepterad' | 'nekad'
  fastighet: string | null
  giltig_till: string | null
  total_excl_moms: number
  moms: number
  total_incl_moms: number
  anteckningar: string | null
  created_by: string | null
  created_at: string
  // joins
  customer?: Customer
  rows?: OfferRow[]
}

export type OfferRow = {
  id: string
  offer_id: string
  artikel_id: string | null
  beskrivning: string
  antal: number
  apris: number
  moms_procent: number
  sort_order: number
  artikel?: Article
}

export type Invoice = {
  id: string
  invoice_number: string | null
  order_id: string | null
  customer_id: string | null
  status: 'utkast' | 'skickad' | 'betald' | 'förfallen'
  forfallodatum: string | null
  betald_datum: string | null
  total_excl_moms: number
  moms: number
  total_incl_moms: number
  hogia_faktura_id: string | null
  hogia_synkad_at: string | null
  created_by: string | null
  created_at: string
  customer?: Customer
}

export type StaffStatus = {
  id: string
  person: string
  datum: string
  typ: 'semester' | 'sjuk' | 'obokningsbar' | 'tidsblock'
  fran_tid: string | null
  till_tid: string | null
  created_at: string
}

// Fastigheter som projekt
export type Fastighet = {
  id: string
  namn: string
  adress: string
  postnummer: string | null
  ort: string | null
  beteckning: string | null
  anteckningar: string | null
  created_at: string
}

export type Hyresobjekt = {
  id: string
  intern_namn: string | null
  titel: string | null
  fastighet: string | null
  typer: string[]
  typ: string | null
  tillganglig_typ: 'datum' | 'overenskommelse'
  tillganglig_fran: string | null
  publicerad: boolean
  total_yta: number | null
  hyra: number | null
  kr_kvm_ar: number | null
  planlosning: string | null
  bilder: string[]
  bekvamligheter: string[]
  kort_beskrivning: string | null
  beskrivning: string | null
  kontakt_namn: string | null
  kontakt_epost: string | null
  kontakt_telefon: string | null
  kontakt_titel: string | null
  created_at: string
  updated_at: string
}
