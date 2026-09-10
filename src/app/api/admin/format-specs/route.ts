import { NextRequest, NextResponse } from "next/server"
import { env } from "@/config/env"
import Groq from "groq-sdk"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { buildSpecTableHtml, parseSpecEntries } from "@/lib/utils/spec-table"
import { checkInputFits, rateLimitResponse } from "@/lib/api/groq/rate-limit"

/**
 * Dulu memakai `llama-3.3-70b-versatile`, tapi model itu ditarik dari akun ini
 * (Groq membalas 404 `model_not_found`, tercatat 24 Agustus 2026) — begitu juga
 * seluruh keluarga `llama-*`. Diganti ke `openai/gpt-oss-120b` per 10 September
 * 2026: dari daftar `GET /openai/v1/models` yang masih ada, ia satu-satunya —
 * bersama `qwen/qwen3.8-27b` — yang lolos mode `response_format: json_object`
 * (kandidat lain, `openai/gpt-oss-20b` dan `qwen/qwen3.6-27b`, membalas 400
 * "Failed to (generate|validate) JSON" pada uji yang sama). Dipilih yang 120b
 * karena sudah dipakai dan terbukti di endpoint pc-prebuild-performance.
 *
 * Catatan lama menyebut gpt-oss membuang beberapa spesifikasi (baterai, berat,
 * garansi); kerincian itu dijaga oleh aturan 1 & 4 di prompt di bawah.
 */
const MODEL = "openai/gpt-oss-120b"

/**
 * Ekstraksi, bukan karangan: suhu 0 supaya spesifikasi yang sama selalu
 * menghasilkan tabel yang sama, dan model tidak "melengkapi" data yang tidak ada.
 */
const TEMPERATURE = 0

/**
 * `gpt-oss-120b` model reasoning: sebagian jatah keluaran habis untuk kanal
 * penalaran sebelum JSON ditulis. Kalau seluruh `max_tokens` termakan penalaran,
 * JSON keluar kosong dan Groq membalas 400 `json_validate_failed`. `low` menahan
 * penalaran agar jatahnya cukup untuk isi tabel — pada uji 10 September 2026
 * tetap menghasilkan cakupan 8/8 tanpa kehilangan kerincian.
 */
const REASONING_EFFORT = "low"

/**
 * Cukup untuk produk dengan ~45 baris spesifikasi. Angka ini memberi ruang
 * untuk penalaran singkat model sekaligus tabelnya.
 *
 * Tidak dinaikkan lebih tinggi karena `max_tokens` DIPESAN di muka terhadap
 * jatah TPM (lihat lib/api/groq/rate-limit.ts): setiap token yang dicadangkan
 * di sini mengurangi panjang tempelan yang masih boleh diproses. Pada 1.500,
 * input masih boleh sampai ~10.000 token (~35 ribu karakter).
 */
const MAX_TOKENS = 1500

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
    const { text } = body

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided to format." }, { status: 400 })
    }

    // Ditolak di sini, sebelum memanggil Groq: kalau dibiarkan lewat, yang
    // kembali adalah 413 mentah berisi id organisasi dan tautan penagihan —
    // dan panggilannya tetap terhitung terhadap kuota.
    const fits = checkInputFits(MODEL, text, MAX_TOKENS)
    if (!fits.ok) {
      return NextResponse.json(
        {
          error: `Teks spesifikasinya terlalu panjang (sekitar ${fits.estimated.toLocaleString("id-ID")} token, batas ${fits.budget.toLocaleString("id-ID")}). Pisah jadi beberapa bagian, lalu rapikan satu per satu.`,
        },
        { status: 413 }
      )
    }

    const prompt = `Kamu asisten untuk platform e-commerce IT.
Ubah spesifikasi produk yang berantakan berikut (biasanya hasil salin-tempel dari marketplace) menjadi data terstruktur.

Aturan:
1. Ambil SEMUA spesifikasi penting. Jangan ada yang dibuang.
2. "k" = nama spesifikasi, "v" = nilainya.
3. Jangan mengarang spesifikasi yang tidak ada di teks.
4. Pisahkan setiap spesifikasi menjadi entri tersendiri. JANGAN menggabungkan dua spesifikasi berbeda ke dalam satu entri (mis. berat dan garansi harus terpisah). Kecuali daftar yang memang satu kesatuan seperti daftar port.
5. ABAIKAN teks promosi toko, syarat pengiriman, imbauan video unboxing, dan basa-basi penjualan — yang diambil hanya spesifikasi teknis produk.

Balas HANYA dalam format JSON berikut:
{"specs":[{"k":"Processor","v":"Intel Core i7-13650HX"}]}

Teks berantakan:
---
${text}
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

    // Balasan yang terpotong di tengah bukan JSON yang sah. Ditangkap di sini
    // supaya pesannya jelas, bukan muncul sebagai "JSON tidak valid" yang
    // membingungkan — dan supaya tabel setengah jadi tidak pernah tersimpan.
    if (choice?.finish_reason === "length") {
      return NextResponse.json(
        {
          error:
            "Spesifikasinya terlalu panjang untuk diproses sekaligus. Coba pisah jadi beberapa bagian, lalu rapikan satu per satu.",
        },
        { status: 422 }
      )
    }

    const raw = choice?.message?.content || ""

    let specs
    try {
      specs = parseSpecEntries(raw)
    } catch {
      return NextResponse.json(
        { error: "Balasan AI tidak bisa dibaca. Coba jalankan sekali lagi." },
        { status: 502 }
      )
    }

    if (specs.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada spesifikasi yang bisa dikenali dari teks tersebut." },
        { status: 422 }
      )
    }

    return NextResponse.json({ html: buildSpecTableHtml(specs), count: specs.length })
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

    console.error("AI Formatting Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: `Gagal merapikan spesifikasi: ${message}` }, { status: 500 })
  }
}
