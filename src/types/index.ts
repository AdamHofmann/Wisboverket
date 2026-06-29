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
  telefon: string | null
  adress: string | null
  postnummer: string | null
  ort: string | null
  orgnummer: string | null
  anteckningar: string | null
  created_at: string
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
  hogia_artikel_id: string | null
  aktiv: boolean
  created_at: string
}

export type Order = {
  id: string
  order_number: string | null
  titel: string
  kategori: string | null
  status: 'aktiv' | 'slutförd' | 'inaktiv'
  customer_id: string | null
  fastighet: string | null
  postnummer: string | null
  ort: string | null
  bokad_datum: string | null
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

// Fastighets-modulen
export type Company = {
  id: string
  namn: string
  orgnummer: string | null
  adress: string | null
  postnummer: string | null
  ort: string | null
  epost: string | null
  telefon: string | null
  created_at: string
}

export type Property = {
  id: string
  company_id: string
  beteckning: string | null
  adress: string
  postnummer: string | null
  ort: string | null
  byggår: number | null
  antal_enheter: number | null
  anteckningar: string | null
  created_at: string
  company?: Company
}

export type Unit = {
  id: string
  property_id: string
  building_id: string | null
  beteckning: string
  typ: string | null
  yta_kvm: number | null
  plan: number | null
  status: 'uthyrd' | 'ledig' | 'underhåll'
  created_at: string
}

export type Tenant = {
  id: string
  namn: string
  typ: 'företag' | 'privat'
  orgnummer: string | null
  personnummer: string | null
  epost: string | null
  telefon: string | null
  adress: string | null
  kontaktperson: string | null
  created_at: string
}

export type Lease = {
  id: string
  unit_id: string
  tenant_id: string
  startdatum: string
  slutdatum: string | null
  bashyra: number
  indexklausul: boolean
  index_basår: number | null
  uppsagningstid_manader: number
  driftskostnader_ansvar: string | null
  anteckningar: string | null
  aktiv: boolean
  created_at: string
  tenant?: Tenant
  unit?: Unit
}

export type Maintenance = {
  id: string
  property_id: string
  unit_id: string | null
  titel: string
  beskrivning: string | null
  status: 'öppen' | 'pågående' | 'stängd'
  prioritet: 'låg' | 'normal' | 'hög' | 'akut'
  rapporterad_av: string | null
  assignad_till: string | null
  created_at: string
  updated_at: string
}
