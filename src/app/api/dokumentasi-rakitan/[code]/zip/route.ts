import { getBuildDocumentationZip, normalizeQuoteCodeParam } from "@/lib/api/ticketing-build-downloads"
import { checkDocumentationAccess, textResponse } from "../access"

export const dynamic = "force-dynamic"

/**
 * Unduh semua foto Dokumentasi Rakitan sebagai satu ZIP:
 *   GET /api/dokumentasi-rakitan/<kode>/zip
 *
 * ZIP-nya dialirkan: foto diambil satu per satu dari storage Ticketing dan
 * langsung diteruskan, jadi server tidak menampung semua foto sekaligus.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const denied = await checkDocumentationAccess()
  if (denied) return denied

  const { code: rawCode } = await params
  const code = normalizeQuoteCodeParam(rawCode)
  if (!code) return textResponse(400, "Kode quotation tidak sesuai format.")

  const result = await getBuildDocumentationZip(code)
  if (result.kind === "error") return textResponse(result.status, result.message)

  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
