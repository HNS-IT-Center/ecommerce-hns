import type { NextRequest } from "next/server"
import { rejectUnauthorizedTicketing, ticketingJson } from "@/lib/api/ticketing-auth"
import { getTicketingPrices, parseTicketingPriceCodes } from "@/lib/api/ticketing-prices"

export const dynamic = "force-dynamic"

/**
 * GET /api/integrations/ticketing/products/prices?codes=K1,K2,… — docs/17 §23.
 *
 * Harga jual web per kode Accurate. Penjagaan token sama dengan §20–22.
 */
export async function GET(request: NextRequest) {
  const rejected = rejectUnauthorizedTicketing(request)
  if (rejected) return rejected

  const codes = parseTicketingPriceCodes(request.nextUrl.searchParams.get("codes"))
  if (!codes) return ticketingJson({ error: "invalid_codes" }, 400)

  return ticketingJson(await getTicketingPrices(codes), 200)
}
