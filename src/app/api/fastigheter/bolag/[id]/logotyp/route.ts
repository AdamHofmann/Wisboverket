// Källa: src/app/api/bolag/[id]/logotyp/route.ts (Prisma + fs.writeFile).
// Migrerad: Prisma → Supabase server-klient, fs.writeFile → Supabase Storage.
//
// Mönster:
//  * prisma.bolag.update → sb.from('f_bolag').update({ logotyp }).eq('id', id).
//  * fs.writeFile(public/uploads/<id>.<ext>) → sb.storage.from('fastigheter')
//    .upload('bolag/<id>/logotyp.<ext>', ...). Bucketen 'fastigheter' är PRIVAT
//    (se PLAN.md §3.3) → vi sparar Storage-PATHEN i logotyp-kolumnen, inte en
//    publik URL. UI:t skapar signed URL vid visning.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil skickades' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    // Deterministisk path per bolag (skriver över föregående logotyp via upsert).
    const storagePath = `bolag/${id}/logotyp.${ext}`

    // TODO(Storage): kräver privat bucket 'fastigheter' + policies (PLAN.md §3.3,
    // mönster 014_order_bilder_storage.sql). Skapas i separat migration.
    const { error: uploadError } = await sb.storage
      .from('fastigheter')
      .upload(storagePath, buffer, {
        contentType: file.type || `image/${ext}`,
        upsert: true,
      })
    if (uploadError) throw uploadError

    // Spara Storage-pathen i logotyp-kolumnen (privat bucket → ingen publik URL).
    const { error: updateError } = await sb
      .from('f_bolag')
      .update({ logotyp: storagePath })
      .eq('id', id)
    if (updateError) throw updateError

    return NextResponse.json({ logotyp: storagePath })
  } catch (err) {
    console.error('ladda upp logotyp error:', err)
    return NextResponse.json({ error: 'Kunde inte ladda upp logotyp' }, { status: 500 })
  }
}
