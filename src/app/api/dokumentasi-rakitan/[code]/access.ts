import { ForbiddenError, UnauthorizedError, requirePermission } from "@/lib/auth"

/**
 * Penjaga bersama route unduhan Dokumentasi Rakitan (docs/17 §21).
 *
 * Izin yang sama dengan halamannya (`dokumentasi-rakitan`, view). Wajib
 * diperiksa DI SINI: `src/proxy.ts` tidak menjangkau /api, dan route ini
 * endpoint tersendiri yang bisa dipanggil tanpa membuka halamannya.
 *
 * Mengembalikan `Response` galat, atau `null` kalau boleh lanjut.
 */
export async function checkDocumentationAccess(): Promise<Response | null> {
  try {
    await requirePermission("dokumentasi-rakitan", "view")
    return null
  } catch (error) {
    if (error instanceof UnauthorizedError) return textResponse(401, "Silakan masuk dengan akun staff dulu.")
    if (error instanceof ForbiddenError) return textResponse(403, "Akun Anda tidak punya akses Dokumentasi Rakitan.")
    throw error
  }
}

/**
 * Teks polos, bukan JSON: tautan unduh dibuka langsung oleh peramban, jadi
 * yang mungkin terbaca staff adalah isi jawaban ini apa adanya.
 */
export function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}
