import { loggaServer } from '@/lib/logg-server'

/**
 * En Next.js route handler. Generisk över signaturen så att både
 * (req), (req, { params }) och NextRequest-baserade handlers accepteras
 * utan cast — den ursprungliga signaturen bevaras på det wrappade svaret.
 */
type RouteHandler = (req: any, ctx?: any) => Promise<Response>

/**
 * Wrappar en Next.js route handler med felloggning och prestandamätning.
 *
 * - Fel loggas alltid (typ 'fel', niva 'error') och kastas sedan vidare
 *   så att Next hanterar dem precis som originalet skulle.
 * - Prestanda loggas SELEKTIVT: bara när routen tar > 1000 ms
 *   (typ 'prestanda').
 * - Loggningen får aldrig störa svaret och kan aldrig krascha appen.
 */
export function withLogg<H extends RouteHandler>(namn: string, handler: H): H {
  const wrappedHandler = async function (req: Request, ctx?: any): Promise<Response> {
    const start = Date.now()

    let path: string | undefined
    try {
      path = new URL(req.url).pathname
    } catch {
      path = undefined
    }

    try {
      const res = await handler(req, ctx)

      const duration_ms = Date.now() - start
      if (duration_ms > 1000) {
        // Fire-and-forget — svälj fel, blockera aldrig svaret.
        void loggaServer({
          typ: 'prestanda',
          kalla: namn,
          meddelande: 'Långsam route',
          duration_ms,
          path,
        })
      }

      return res
    } catch (err) {
      const duration_ms = Date.now() - start
      const meddelande = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined

      // Fire-and-forget — svälj fel, blockera aldrig felhanteringen.
      void loggaServer({
        typ: 'fel',
        niva: 'error',
        kalla: namn,
        meddelande,
        path,
        duration_ms,
        detaljer: { stack },
      })

      throw err
    }
  }

  return wrappedHandler as H
}
