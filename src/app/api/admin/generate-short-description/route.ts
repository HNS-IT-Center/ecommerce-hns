import { NextRequest, NextResponse } from "next/server"
import { env } from "@/config/env"
import Groq from "groq-sdk"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { checkInputFits, rateLimitResponse } from "@/lib/api/groq/rate-limit"

/**
 * Sengaja BERBEDA dari model di format-specs, dan bukan karena yang ini "lebih
 * besar berarti lebih baik". Ini satu-satunya teks di panel admin yang dibaca
 * langsung oleh pembeli, dan selisih kualitasnya kentara pada spesifikasi yang
 * sama:
 *
 *   llama-3.1-8b : "Mainkan game favorit Anda dengan kinerja luar biasa dan
 *                   grafis yang mengagumkan menggunakan ASUS ROG Strix G16,
 *                   dilengkapi dengan…"  (~205 karakter, melewati target 160)
 *   llama-3.3-70b: "Laptop gaming ASUS ROG Strix G16 dengan prosesor Intel Core
 *                   i7 dan VGA NVIDIA GeForce RTX 4060 untuk pengalaman bermain
 *                   yang mulus."          (~130 karakter, langsung ke inti)
 *
 * Tidak ada yang dikorbankan: karena menulis lebih ringkas, yang 70b justru
 * lebih cepat di sini (0,3 dtk vs 1,2 dtk) dengan token lebih sedikit.
 *
 * `qwen/qwen3.6-27b` dan `openai/gpt-oss-*` tidak bisa dipakai untuk kedua
 * endpoint ini — keduanya membalas 400 "Failed to validate JSON" pada mode
 * response_format json_object.
 */
const MODEL = "llama-3.3-70b-versatile"

/**
 * Berbeda dari format-specs yang bersuhu 0: ini teks yang DIBACA PEMBELI, bukan
 * data internal. Pada suhu 0 ribuan produk akan memakai pola kalimat nyaris
 * identik — buruk untuk pengalaman belanja sekaligus memunculkan konten duplikat
 * massal di mata mesin pencari. 0.35 cukup untuk memberi variasi tanpa membuat
 * model mulai mengarang spesifikasi.
 */
const TEMPERATURE = 0.35

/** Targetnya ~160 karakter (±60 token); sisanya cuma jaring pengaman. */
const MAX_TOKENS = 300

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
