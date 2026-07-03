// Migrerad route. Källa: src/app/api/avtalsdokument/route.ts (Prisma + fs.writeFile).
//
// Mönster som demonstreras:
//  * Prisma-modell AvtalsDokument → tabell f_avtalsdokument (snake_case-kolumner).
//  * camelCase-fält (hyresavtalId) → snake_case (hyresavtal_id).
//  * fs.writeFile → public/uploads → Supabase Storage-bucket 'fastigheter' (privat).
//    - sokvag lagrar Storage-path (INTE en /uploads-URL): `dokument/<hyresavtalId>/<filnamn>`.
//  * findMany/create/delete → Supabase from()/insert()/delete().
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'fastigheter'

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const hyresavtalId = searchParams.get('hyresavtalId')
    if (!hyresavtalId) return NextResponse.json({ error: 'hyresavtalId krävs' }, { status: 400 })

    const { data, error } = await sb
      .from('f_avtalsdokument')
      .select('*')
      .eq('hyresavtal_id', hyresavtalId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('GET /api/fastigheter/avtalsdokument error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const formData = await request.formData()
    const file = formData.get('file') as File
    const hyresavtalId = formData.get('hyresavtalId') as string
    const typ = (formData.get('typ') as string) || 'ovrigt'
    const namn = (formData.get('namn') as string) || (file ? file.name : '')

    if (!file || !hyresavtalId) {
      return NextResponse.json({ error: 'Fil och hyresavtalId krävs' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // fs.writeFile → Supabase Storage upload.
    // Path speglar källans katalogstruktur: dokument/<hyresavtalId>/<timestamp><ext>.
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
    const filnamn = `${Date.now()}${ext}`
    const sokvag = `dokument/${hyresavtalId}/${filnamn}`

    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(sokvag, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
    if (uploadError) throw uploadError

    const { data: dokument, error } = await sb
      .from('f_avtalsdokument')
      .insert({
        hyresavtal_id: hyresavtalId,
        namn,
        typ,
        filnamn: file.name,
        filstorlek: buffer.length,
        sokvag,
      })
      .select()
      .single()
    if (error) {
      // Rensa upp uppladdad fil om DB-insert misslyckas (ingen Prisma-transaktion här).
      await sb.storage.from(BUCKET).remove([sokvag])
      throw error
    }

    return NextResponse.json(dokument, { status: 201 })
  } catch (e) {
    console.error('POST /api/fastigheter/avtalsdokument error:', e)
    return NextResponse.json({ error: 'Kunde inte ladda upp' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 })

    const { data: dok } = await sb
      .from('f_avtalsdokument')
      .select('sokvag')
      .eq('id', id)
      .single()

    if (dok?.sokvag) {
      // fs.unlink → Storage remove. Ignorera fel (filen kanske redan borta).
      await sb.storage.from(BUCKET).remove([dok.sokvag])
    }

    const { error } = await sb.from('f_avtalsdokument').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/fastigheter/avtalsdokument error:', e)
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
