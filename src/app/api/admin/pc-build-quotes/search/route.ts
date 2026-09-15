import { NextResponse, type NextRequest } from "next/server"

import { ForbiddenError, UnauthorizedError, requirePermission } from "@/lib/auth"
import { normalizeQuoteSearchTerm, searchQuotesByCode } from "@/lib/api/pc-build-quotes"

/**
 * Saran kode quotation untuk kolom pencarian di /verify.
 *
 * Izin diperiksa DI SINI, bukan diandalkan dari halaman /verify: route ini
 * endpoint HTTP tersendiri yang bisa dipanggil langsung, dan `src/proxy.ts`
 * tidak menjangkau /api. Tanpa pemeriksaan ini, siapa pun bisa mengeruk daftar
 * kode dan total rakitan dengan mengetik dua karakter berulang-ulang.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("verify", "view")

    const term = normalizeQuoteSearchTerm(request.nextUrl.searchParams.get("q") ?? "")
    if (!term) return NextResponse.json({ results: [] })

    const results = await searchQuotesByCode(term)
    return NextResponse.json({ results })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: "Akun Anda tidak punya akses verifikasi rakitan." },
        { status: 403 }
      )
    }
    console.error("[verify] gagal mencari quotation:", error)
    return NextResponse.json({ error: "Gagal mencari quotation." }, { status: 500 })
  }
}
