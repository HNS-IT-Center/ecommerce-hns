import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/config/env"

/**
 * Penjaga bersama rute `/api/integrations/ticketing/*` — docs/17 §20.
 *
 * Panggilan SERVER-KE-SERVER dari aplikasi Ticketing HNS: tanpa sesi login,
 * tanpa cookie, tanpa CORS. Satu-satunya penjaga adalah token
 * `TICKETING_INTEGRATION_TOKEN`. Diletakkan di satu berkas supaya rute yang
 * mencari lewat kode dan lewat token publik tidak bisa berbeda penjagaannya.
 *
 * Token diterima di DUA header, dan itu disengaja:
 *   - `Authorization: Bearer <token>` — bentuk utama;
 *   - `X-Ticketing-Token: <token>` — cadangan. Belum pernah terbukti bahwa
 *     proxy Hostinger meneruskan header `Authorization` ke aplikasi Node
 *     (cron `/api/cron/sinkron-stok` yang memakainya pun belum terbukti
 *     jalan). Kalau ternyata dibuang, Ticketing cukup pindah header tanpa
 *     menunggu deploy ecommerce. Kalau keduanya dikirim, Bearer yang dipakai.
 *
 * Kenapa token, bukan SSO: SSO HNS tidak punya grant `client_credentials`,
 * dan access token SSO hanya sah untuk aplikasi yang memintanya (docs/19 §1).
 */

export function ticketingJson(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    // Berisi nama & nomor HP pelanggan: tidak boleh tersimpan di cache mana pun.
    headers: { "Cache-Control": "no-store" },
  })
}

function presentedToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim() || null
  return request.headers.get("x-ticketing-token")?.trim() || null
}

/**
 * Dibandingkan sebagai SHA-256 supaya `timingSafeEqual` selalu menerima dua
 * buffer sama panjang — membandingkan panjang lebih dulu membocorkan panjang
 * token yang benar. Pola yang sama dengan `/api/revalidate`.
 */
function tokenMatches(presented: string, expected: string): boolean {
  const a = createHash("sha256").update(presented).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * `null` = boleh lanjut. Selain itu, respons penolakan yang harus langsung
 * dikembalikan rute: 503 kalau token belum dipasang (endpoint TIDAK PERNAH
 * terbuka tanpanya), 401 kalau token tidak ada atau salah.
 */
export function rejectUnauthorizedTicketing(request: NextRequest): NextResponse | null {
  const expected = env.TICKETING_INTEGRATION_TOKEN
  if (!expected) return ticketingJson({ error: "not_configured" }, 503)

  const presented = presentedToken(request)
  if (!presented || !tokenMatches(presented, expected)) return ticketingJson({ error: "unauthorized" }, 401)

  return null
}

/** `decodeURIComponent` yang tidak melempar — segmen rusak dianggap tidak sah. */
export function decodeSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}
