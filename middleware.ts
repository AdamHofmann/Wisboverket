import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  // Skydda appen, men lämna den publika hemsidan + SEO + formulär-endpoints öppna.
  const p = request.nextUrl.pathname
  const ärOffentlig =
    p === '/' ||                       // publik startsida (marknadssidan)
    p === '/integritetspolicy' ||      // publik policy-sida
    p === '/robots.txt' ||             // SEO
    p === '/sitemap.xml' ||            // SEO
    p === '/manifest.webmanifest' ||   // PWA-manifest
    p.startsWith('/login') ||
    p.startsWith('/api/public/')       // publika formulär (uthyrning/förfrågan/felanmälan)
  if ((error || !user) && !ärOffentlig) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
