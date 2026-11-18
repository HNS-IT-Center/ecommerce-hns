import type { NextRequest } from "next/server"

import { getBuildPhotoDownload, normalizeQuoteCodeParam } from "@/lib/api/ticketing-build-downloads"
import { checkDocumentationAccess, textResponse } from "../../access"

export const dynamic = "force-dynamic"

/**
 * Unduh satu foto Dokumentasi Rakitan:
 *   GET /api/dokumentasi-rakitan/<kode>/foto/<nomor>?k=<sidik>
 *
 * `nomor` dan `k` datang dari halaman (`numberBuildPhotos`); URL fotonya
 * dipilih server dari jawaban Ticketing. Lihat `ticketing-build-downloads.ts`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string; number: string }> }) {
  const denied = await checkDocumentationAccess()
  if (denied) return denied

  const { code: rawCode, number: rawNumber } = await params
  const code = normalizeQuoteCodeParam(rawCode)
  if (!code) return textResponse(400, "Kode quotation tidak sesuai format.")

  const number = /^\d{1,4}$/.test(rawNumber) ? Number(rawNumber) : NaN
  const key = request.nextUrl.searchParams.get("k") ?? ""
  if (!Number.isInteger(number) || number < 1 || !/^[0-9a-f]{12}$/.test(key)) {
    return textResponse(400, "Tautan unduhan tidak lengkap. Muat ulang halaman Dokumentasi Rakitan.")
  }

  const result = await getBuildPhotoDownload(code, number, key)
  if (result.kind === "error") return textResponse(result.status, result.message)

  const headers = new Headers({
    "Content-Type": result.contentType,
    // Nama berkas hanya berisi kode quotation + slug (A-Z, a-z, 0-9, `-`, `.`).
    "Content-Disposition": `attachment; filename="${result.fileName}"`,
    // Halaman ber-izin: jangan pernah disimpan CDN atau cache bersama.
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  })
  if (result.contentLength) headers.set("Content-Length", result.contentLength)
  return new Response(result.body, { headers })
}
