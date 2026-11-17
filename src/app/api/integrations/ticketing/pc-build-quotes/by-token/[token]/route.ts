import type { NextRequest } from "next/server"
import { decodeSegment, rejectUnauthorizedTicketing, ticketingJson } from "@/lib/api/ticketing-auth"
import { getQuoteForTicketing, normalizeTicketingPublicToken } from "@/lib/api/ticketing-quotes"

export const dynamic = "force-dynamic"

/**
 * GET /api/integrations/ticketing/pc-build-quotes/by-token/{token} — docs/17 §20.
 *
 * Sama persis dengan pencarian lewat kode, tapi memakai token acak tautan
 * publik `/q/<token>`: staff cukup menempel tautan yang dikirim sales lewat
 * WhatsApp, dan Ticketing yang memotong `<token>`-nya.
 *
 * Tidak membuka apa pun yang baru: pemegang token integrasi sudah bisa membaca
 * setiap quotation lewat kodenya. Token publik di sini hanya cara lain untuk
 * MENUNJUK satu quotation.
 *
 * Tidak bentrok dengan `[code]`: rute itu satu segmen, ini dua.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rejected = rejectUnauthorizedTicketing(request)
  if (rejected) return rejected

  const { token: rawToken } = await params
  const decoded = decodeSegment(rawToken)
  const publicToken = decoded === null ? null : normalizeTicketingPublicToken(decoded)
  if (!publicToken) return ticketingJson({ error: "invalid_token" }, 400)

  const quote = await getQuoteForTicketing({ publicToken })
  if (!quote) return ticketingJson({ error: "not_found" }, 404)

  return ticketingJson(quote, 200)
}
