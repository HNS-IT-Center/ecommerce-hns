import type { NextRequest } from "next/server"
import { decodeSegment, rejectUnauthorizedTicketing, ticketingJson } from "@/lib/api/ticketing-auth"
import { getQuoteForTicketing, normalizeTicketingQuoteCode } from "@/lib/api/ticketing-quotes"

export const dynamic = "force-dynamic"

/**
 * GET /api/integrations/ticketing/pc-build-quotes/{code} — docs/17 §20.
 *
 * Penjagaan token ada di `lib/api/ticketing-auth.ts`, dipakai bersama rute
 * `by-token/{token}`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const rejected = rejectUnauthorizedTicketing(request)
  if (rejected) return rejected

  const { code: rawCode } = await params
  const decoded = decodeSegment(rawCode)
  const code = decoded === null ? null : normalizeTicketingQuoteCode(decoded)
  if (!code) return ticketingJson({ error: "invalid_code" }, 400)

  const quote = await getQuoteForTicketing({ code })
  if (!quote) return ticketingJson({ error: "not_found" }, 404)

  return ticketingJson(quote, 200)
}
