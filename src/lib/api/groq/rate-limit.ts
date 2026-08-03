/**
 * Penjaga batas laju Groq.
 *
 * Groq membatasi TPM (token per menit) per model, dan yang dihitung BUKAN cuma
 * token yang benar-benar dipakai — `max_tokens` ikut dipesan di muka. Jadi
 * sebuah permintaan ditolak kalau `token_input + max_tokens > TPM`, walaupun
 * jawabannya nanti cuma beberapa ratus token.
 *
 * Konsekuensinya berlawanan dengan dugaan: menaikkan `max_tokens` "untuk
 * jaga-jaga" justru memperbesar peluang kena 413. Dan model yang lebih kecil
 * belum tentu lebih lega — di organisasi ini `llama-3.1-8b-instant` justru
 * punya jatah paling sempit.
 *
 * Angka di bawah dibaca dari header `x-ratelimit-limit-tokens` (tier on_demand).
 * Kalau tier akun dinaikkan, perbarui angkanya di sini.
 */
export const GROQ_TPM: Record<string, number> = {
  "llama-3.3-70b-versatile": 12000,
  "openai/gpt-oss-120b": 8000,
  "openai/gpt-oss-20b": 8000,
  "qwen/qwen3.6-27b": 8000,
  "llama-3.1-8b-instant": 6000,
  "groq/compound": 70000,
}

/** Cadangan untuk kerangka prompt & meleset-nya perkiraan token. */
const SAFETY_MARGIN_TOKENS = 500

/**
 * Perkiraan jumlah token sebuah teks.
 *
 * Pembagi 3,5 diambil dari pengukuran nyata pada teks spesifikasi campuran
 * Indonesia-Inggris (15.116 karakter -> 4.307 token). Sengaja memakai angka
 * yang cenderung MELEBIHKAN perkiraan: kelebih-perkiraan cuma membuat kita
 * menolak lebih awal dengan pesan yang jelas, sedangkan kekurang-perkiraan
 * berujung 413 mentah dari Groq di hadapan pengguna.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

/** Berapa banyak token input yang masih muat untuk model & `max_tokens` tertentu. */
export function inputTokenBudget(model: string, maxTokens: number): number {
  const tpm = GROQ_TPM[model] ?? 6000
  return tpm - maxTokens - SAFETY_MARGIN_TOKENS
}

export type RateLimitCheck =
  | { ok: true }
  | { ok: false; estimated: number; budget: number }

export function checkInputFits(
  model: string,
  text: string,
  maxTokens: number
): RateLimitCheck {
  const estimated = estimateTokens(text)
  const budget = inputTokenBudget(model, maxTokens)
  return estimated <= budget ? { ok: true } : { ok: false, estimated, budget }
}

/** Jeda default kalau Groq tidak menyertakan header `retry-after`. */
const DEFAULT_RETRY_AFTER_SECONDS = 20

function readRetryAfter(error: unknown): number {
  const headers = (error as { headers?: unknown })?.headers
  const raw =
    headers instanceof Headers
      ? headers.get("retry-after")
      : (headers as Record<string, string> | undefined)?.["retry-after"]

  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : DEFAULT_RETRY_AFTER_SECONDS
}

export type RateLimitResponse = {
  status: 413 | 429
  message: string
  /** Detik yang disarankan sebelum mencoba lagi. 0 = mencoba lagi tidak akan menolong. */
  retryAfter: number
}

/**
 * Ubah galat batas laju dari Groq menjadi jawaban yang berguna bagi admin.
 *
 * Tanpa ini, yang muncul di panel adalah JSON mentah berisi id organisasi dan
 * tautan penagihan — tidak memberi tahu apa pun tentang apa yang harus
 * dilakukan sekarang.
 *
 * Dua kondisi ini sengaja dibedakan, karena tindak lanjutnya berlawanan:
 * 429 berarti jatah semenit ini habis dan akan pulih sendiri (layak dicoba
 * ulang otomatis), sedangkan 413 berarti permintaannya sendiri kebesaran —
 * mengulanginya akan gagal lagi dengan cara yang sama persis.
 */
export function rateLimitResponse(error: unknown): RateLimitResponse | null {
  const status = (error as { status?: number })?.status

  if (status === 429) {
    return {
      status: 429,
      message: "Kuota AI per menit sedang penuh. Sedang menunggu kuota pulih…",
      retryAfter: readRetryAfter(error),
    }
  }

  if (status === 413) {
    return {
      status: 413,
      message:
        "Teksnya terlalu panjang untuk diproses sekaligus. Pisah spesifikasinya jadi beberapa bagian, lalu proses satu per satu.",
      retryAfter: 0,
    }
  }

  return null
}
