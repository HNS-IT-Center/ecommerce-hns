/**
 * Batas laju in-memory per-IP, dipakai bersama oleh endpoint publik yang
 * MENULIS ke database atau MENGIRIM email atas permintaan yang tidak
 * diautentikasi: daftar, kirim ulang verifikasi, lupa password.
 *
 * Generalisasi dari `google-callback-rate-limit.ts` (pola & alasan identik
 * — lihat catatan di sana) supaya tiga endpoint ini tidak menyalin
 * implementasi yang sama tiga kali. Setiap endpoint punya window/map-nya
 * SENDIRI (dipanggil dengan `key` berbeda), supaya membanjiri satu endpoint
 * tidak ikut menghabiskan jatah endpoint lain untuk IP yang sama.
 */

const WINDOW_MS = 60_000
const MAX_ATTEMPTS_PER_WINDOW = 5

const attemptsByBucket = new Map<string, Map<string, { count: number; windowStart: number }>>()

let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 5 * 60_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const bucket of attemptsByBucket.values()) {
    for (const [key, entry] of bucket) {
      if (now - entry.windowStart >= WINDOW_MS) bucket.delete(key)
    }
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

/**
 * @param bucket Nama endpoint ("register" | "resend_verification" |
 * "forgot_password") — mengunci ke Map terpisah per endpoint.
 * @param ip Dari `clientIpFrom(headers)`.
 */
export function checkRateLimit(bucket: string, ip: string): RateLimitResult {
  const now = Date.now()
  sweep(now)

  let attempts = attemptsByBucket.get(bucket)
  if (!attempts) {
    attempts = new Map()
    attemptsByBucket.set(bucket, attempts)
  }

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
