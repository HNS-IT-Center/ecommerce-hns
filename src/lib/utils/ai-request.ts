"use client"

/**
 * Pemanggil endpoint AI admin dengan percobaan ulang otomatis.
 *
 * Jatah token Groq dihitung per menit berjalan dan dipakai bersama oleh kedua
 * tombol AI. Saat menyunting banyak produk berturut-turut, jatah semenit itu
 * wajar habis di tengah jalan — dan itu keadaan sementara yang pulih sendiri,
 * bukan kesalahan yang perlu ditimpakan ke pengguna. Alih-alih menampilkan
 * "kuota penuh" lalu menyuruh staff menekan tombol lagi, permintaan ditahan
 * sebentar lalu diulang sendiri sambil menghitung mundur.
 *
 * Yang TIDAK diulang: 413 (teksnya memang kebesaran) dan galat lain. Mengulang
 * keduanya hanya menunda pesan yang sama.
 */

const MAX_ATTEMPTS = 3
const FALLBACK_RETRY_SECONDS = 20

export type AiRequestEvents = {
  /** Dipanggil tiap detik selama menunggu; 0 berarti tunggu selesai. */
  onWaiting?: (secondsLeft: number) => void
}

async function waitWithCountdown(seconds: number, onWaiting?: (secondsLeft: number) => void) {
  for (let left = Math.ceil(seconds); left > 0; left -= 1) {
    onWaiting?.(left)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  onWaiting?.(0)
}

export async function requestAi<T>(
  url: string,
  body: unknown,
  events: AiRequestEvents = {}
): Promise<T> {
  let lastError = "Gagal menghubungi layanan AI"

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data: { error?: string; retryAfter?: number } = await res.json().catch(() => ({}))
    if (res.ok) return data as T

    lastError = data.error || `Permintaan gagal (${res.status})`

    if (res.status !== 429 || attempt === MAX_ATTEMPTS) break

    await waitWithCountdown(data.retryAfter || FALLBACK_RETRY_SECONDS, events.onWaiting)
  }

  throw new Error(lastError)
}
