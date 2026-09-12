/**
 * Batas laju sederhana untuk `/api/auth/google/callback`.
 *
 * Endpoint itu publik dan MENULIS ke database (membuat baris `customers`
 * saat pelanggan baru pertama kali masuk) — lihat docs/09 §9.2. Ini bukan
 * pertahanan terhadap penyerang canggih, hanya penjaga supaya permintaan
 * gagal berulang (bot, tab yang direfresh berkali-kali, callback yang
 * dicoba manual) tidak membanjiri tabel.
 *
 * In-memory, per instance server — cukup untuk skala tim ini (lihat
 * project_hns_db_connection_cap: tim dua orang, trafik kecil). TIDAK
 * tersebar antar instance; kalau suatu saat deploy multi-instance jadi
 * masalah nyata, ganti dengan penyimpanan bersama (mis. tabel/Redis), bukan
 * menambah kerumitan di sini lebih dulu.
 */

const WINDOW_MS = 60_000
const MAX_ATTEMPTS_PER_WINDOW = 10

const attempts = new Map<string, { count: number; windowStart: number }>()

// Cegah `attempts` tumbuh tanpa batas dari IP yang cuma mampir sekali.
// Dibersihkan sesekali, bukan per-request, supaya tidak menambah biaya ke
// jalur normal.
let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 5 * 60_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, entry] of attempts) {
    if (now - entry.windowStart >= WINDOW_MS) attempts.delete(key)
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number }

/** Identitas yang dipakai: IP dari header proxy standar, atau "unknown" sebagai fallback konservatif. */
export function clientIpFrom(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim()
  const realIp = headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}

export function checkGoogleCallbackRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const entry = attempts.get(ip)
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now })
    return { ok: true }
  }

  if (entry.count >= MAX_ATTEMPTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000)
    return { ok: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) }
  }

  entry.count += 1
  return { ok: true }
}
