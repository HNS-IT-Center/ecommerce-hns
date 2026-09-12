import { NextRequest, NextResponse } from "next/server"
import { env } from "@/config/env"
import Groq from "groq-sdk"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { checkInputFits, rateLimitResponse } from "@/lib/api/groq/rate-limit"

/**
 * Sama dengan format-specs: `openai/gpt-oss-120b`. Model llama yang dulu dipakai
 * di sini (`llama-3.3-70b-versatile`) sudah tidak ada lagi di akun ini, begitu
 * juga seluruh keluarga `llama-*` (Groq 404 `model_not_found`).
 *
 * Catatan lama di berkas ini menyatakan `openai/gpt-oss-*` "membalas 400 Failed
 * to validate JSON pada response_format json_object" — itu TERBANTAH pada uji
 * ulang 10 September 2026: `gpt-oss-120b` lolos bersih (`gpt-oss-20b` dan
 * `qwen3.6-27b` yang gagal; `qwen3.8-27b` juga lolos). Dipilih yang 120b karena
 * satu model untuk ketiga endpoint AI memudahkan perawatan dan sudah terbukti di
 * pc-prebuild-performance.
 *
 * Teks ini yang dibaca langsung pembeli; batas ~160 karakter dijaga oleh aturan
 * prompt dan `max_tokens` di bawah, bukan oleh pilihan model.
 */
const MODEL = "openai/gpt-oss-120b"

/**
 * Berbeda dari format-specs yang bersuhu 0: ini teks yang DIBACA PEMBELI, bukan
 * data internal. Pada suhu 0 ribuan produk akan memakai pola kalimat nyaris
 * identik — buruk untuk pengalaman belanja sekaligus memunculkan konten duplikat
 * massal di mata mesin pencari. 0.35 cukup untuk memberi variasi tanpa membuat
 * model mulai mengarang spesifikasi.
 */
const TEMPERATURE = 0.35

/**
 * `gpt-oss-120b` adalah model reasoning: ia memakai sebagian jatah keluaran
 * untuk kanal penalaran SEBELUM menulis JSON. Tanpa dikekang, penalaran itu
 * menghabiskan seluruh `max_tokens` dan JSON-nya keluar kosong — Groq lalu
 * membalas 400 `json_validate_failed` dengan `failed_generation:""`. Disetel
 * `low` supaya jatahnya cukup untuk isi JSON. (Diukur 10 September 2026 pada
 * tempelan spesifikasi panjang: tanpa ini gagal 3/3.)
 */
const REASONING_EFFORT = "low"

/**
 * Targetnya ~160 karakter, tapi 300 TIDAK cukup untuk model reasoning ini:
 * meski `reasoning_effort` sudah `low`, pada 300 hasilnya masih rapuh (lolos
 * 2/3, sisanya JSON kosong). Pada 800 lolos 3/3. Ini jaring pengaman keluaran,
 * bukan target panjang — deskripsinya tetap ~160 karakter karena aturan prompt.
 * Masih jauh di bawah TPM 8.000, jadi kelonggaran tempelan input tetap lega.
 */
const MAX_TOKENS = 800

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Endpoint ini di /api (di luar jangkauan proxy /admin) dan memanggil Groq
 * memakai API key milik sistem — tanpa pemeriksaan di bawah, siapa pun yang
 * tahu alamatnya bisa menghabiskan kuota API atas nama kita.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const groqApiKey = env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured in the environment variables." },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { description } = body

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "No description provided." }, { status: 400 })
    }

    const plainText = stripHtml(description)
    if (!plainText) {
      return NextResponse.json(
        { error: "Deskripsi lengkap kosong, tidak ada yang bisa diringkas." },
        { status: 400 }
      )
    }

    // Lihat catatan yang sama di format-specs: dicegat sebelum memanggil Groq
    // supaya pesannya berguna dan kuota tidak terbakar percuma.
    const fits = checkInputFits(MODEL, plainText, MAX_TOKENS)
    if (!fits.ok) {
      return NextResponse.json(
        {
          error: `Deskripsi lengkapnya terlalu panjang untuk diringkas sekaligus (sekitar ${fits.estimated.toLocaleString("id-ID")} token, batas ${fits.budget.toLocaleString("id-ID")}). Ringkas manual atau pangkas dulu bagian yang tidak perlu.`,
        },
        { status: 413 }
      )
    }

    const prompt = `Kamu copywriter e-commerce Indonesia untuk toko IT (PC, laptop, komponen, gaming gear).
Tulis SATU deskripsi singkat produk (maksimal 2 kalimat, sekitar 160 karakter) dalam Bahasa Indonesia yang menarik untuk calon pembeli, berdasarkan spesifikasi di bawah.

Aturan:
1. Jangan mengarang spesifikasi yang tidak ada di teks.
2. Jangan pakai HTML atau markdown, cukup teks polos.
3. Sebut keunggulan yang paling menjual, bukan menyalin seluruh spesifikasi.

Balas HANYA dalam format JSON berikut:
{"description":"..."}

Spesifikasi lengkap:
---
${plainText}
---`

    const groq = new Groq({ apiKey: groqApiKey })
    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      reasoning_effort: REASONING_EFFORT,
      response_format: { type: "json_object" },
    })

    const choice = response.choices[0]
    if (choice?.finish_reason === "length") {
      return NextResponse.json(
        { error: "Balasan AI terpotong. Coba jalankan sekali lagi." },
        { status: 502 }
      )
    }

    const raw = choice?.message?.content || ""

    let text = ""
    try {
      const parsed: unknown = JSON.parse(raw)
      const value = (parsed as { description?: unknown }).description
      if (typeof value === "string") text = value.trim()
    } catch {
      return NextResponse.json(
        { error: "Balasan AI tidak bisa dibaca. Coba jalankan sekali lagi." },
        { status: 502 }
      )
    }

    if (!text) {
      return NextResponse.json(
        { error: "AI tidak menghasilkan deskripsi. Coba jalankan sekali lagi." },
        { status: 502 }
      )
    }

    return NextResponse.json({ text })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    const limit = rateLimitResponse(error)
    if (limit) {
      return NextResponse.json(
        { error: limit.message, retryAfter: limit.retryAfter },
        { status: limit.status }
      )
    }

    console.error("AI Short Description Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: `Gagal membuat deskripsi singkat: ${message}` },
      { status: 500 }
    )
  }
}
