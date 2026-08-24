import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"

import { env } from "@/config/env"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { checkInputFits, rateLimitResponse } from "@/lib/api/groq/rate-limit"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getAnalysisProducts } from "@/lib/pc-prebuild/analysis-input"
import {
  COMPONENT_ROLE_LABELS,
  detectComponentRole,
  missingRequiredRoles,
  type PrebuildComponentRole,
} from "@/lib/pc-prebuild/component-roles"
import { getPcPrebuildGames } from "@/lib/pc-prebuild/config"
import { MAX_OPTIONS_PER_SLOT } from "@/lib/pc-prebuild/limits"
import {
  MAX_UPGRADE_SUGGESTIONS,
  PREBUILD_QUALITY_PRESETS,
  PREBUILD_RESOLUTION_TIERS,
  PREBUILD_USE_CASES,
  fingerprintSlots,
  parsePrebuildPerformance,
} from "@/lib/pc-prebuild/performance"

/**
 * Menghitung perkiraan performa satu paket PC Prebuild lewat Groq.
 *
 * ## Kenapa BUKAN `llama-3.3-70b-versatile` seperti dua endpoint AI lain
 *
 * Karena model itu **sudah tidak ada di akun ini** (24 Agustus 2026, Groq
 * membalas 404 `model_not_found`). Dua endpoint lain di panel ini masih
 * menunjuk model tersebut dan karena itu sedang mati juga.
 *
 * ## Dan kenapa `openai/gpt-oss-120b`, yang katanya tidak bisa JSON
 *
 * Catatan di `format-specs` dan `generate-short-description` menyatakan
 * `openai/gpt-oss-*` dan `qwen/qwen3.6-27b` membalas 400 "Failed to validate
 * JSON" pada mode `response_format: json_object`. **Itu tidak benar lagi** —
 * dan penyebab aslinya bukan modelnya, melainkan `max_tokens` yang kekecilan:
 * ketiganya menulis token PENALARAN lebih dulu, dan penalaran itu ikut memakan
 * jatah `max_tokens`. Kalau jatahnya habis sebelum JSON-nya keluar, yang
 * dikembalikan Groq adalah `json_validate_failed` dengan `failed_generation`
 * kosong — terbaca seperti model yang tidak sanggup, padahal ia cuma terpotong.
 *
 * Diukur pada prompt ini (input 1.220 token):
 *   gpt-oss-120b, max_tokens 200    GAGAL json_validate_failed
 *   gpt-oss-120b, max_tokens 4000   OK — 736 token keluar, 3,9 dtk  <- dipakai
 *   qwen3.6-27b,  max_tokens 4000   OK
 *   groq/compound                   GAGAL "Request Entity Too Large"
 *
 * 120b dipilih karena pengetahuan perangkat kerasnya paling luas di antara yang
 * tersisa, dan itulah seluruh isi pekerjaan di sini.
 */
const MODEL = "openai/gpt-oss-120b"

/**
 * Penalaran rendah — dan itu keputusan yang sempat terbalik.
 *
 * Pada percobaan pertama `low` terlihat lebih buruk: ia membuang Red Dead
 * Redemption 2 dari daftar FPS (padahal RTX 4060 menjalankannya dengan wajar)
 * dan menulis "RAM 8 GB single channel" untuk paket yang jelas-jelas sudah
 * 16 GB dual channel. Dua-duanya ternyata BUKAN soal penalaran, melainkan
 * cacat prompt: contoh JSON di bawah dulu berisi nilai yang terlihat masuk akal
 * ("8 GB single channel" → "16 GB dual channel"), dan model menyalinnya sebagai
 * fakta alih-alih membaca daftar komponen.
 *
 * Setelah contohnya diganti placeholder dan aturan 5 & 7 dipertegas, `low`
 * menghasilkan mutu yang setara `medium` dengan sepertiga token:
 *
 *   low     856 token keluar (318 penalaran), 3,4 dtk
 *   medium  2.292 token keluar (1.697 penalaran), 8,1 dtk
 *
 * Yang 2.292 itu tinggal 208 token dari batas `max_tokens` — terlalu mepet
 * untuk paket dengan daftar game penuh.
 *
 * Pelajarannya untuk perubahan berikutnya: kalau keluarannya salah, periksa
 * dulu promptnya sebelum menaikkan jatah berpikir model.
 */
const REASONING_EFFORT = "low"

/**
 * Rendah, tapi bukan nol.
 *
 * Nol membuat model gampang terjebak pola jawaban yang sama untuk paket yang
 * berbeda tipis. Terlalu tinggi membuat dua kali "hitung ulang" pada paket yang
 * sama persis menghasilkan angka yang berbeda jauh — dan staff kehilangan alasan
 * untuk mempercayai angka mana pun. 0,2 cukup rapat untuk itu.
 */
const TEMPERATURE = 0.2

/**
 * HARUS memuat token penalaran, bukan cuma JSON-nya.
 *
 * Keluaran terukur pada delapan game: 856 token (318 di antaranya penalaran).
 * 2.500 memberi kelonggaran untuk daftar game yang penuh (12 baris) tanpa
 * membuat jatah semenit habis dalam satu panggilan.
 *
 * Ini juga alasan angkanya tidak dinaikkan lagi: `max_tokens` DIPESAN di muka
 * terhadap jatah TPM (lihat lib/api/groq/rate-limit.ts), dan TPM model ini
 * 8.000. Pada 2.500, dua kali "hitung" dalam satu menit masih muat
 * (2 x (1.220 + 2.500) = 7.440); pada 4.000 yang kedua sudah kena 429 —
 * padahal menghitung dua paket berturut-turut justru yang lazim dilakukan
 * staff.
 */
const MAX_TOKENS = 2500

/** Jaring pengaman bentuk badan permintaan; paket nyata jauh di bawah ini. */
const MAX_SLOTS = 24

type SlotMasuk = {
  stepId: string
  options: { productId: number; quantity: number }[]
}

function bacaSlots(value: unknown): SlotMasuk[] {
  if (!Array.isArray(value)) return []

  const hasil: SlotMasuk[] = []

  for (const mentah of value.slice(0, MAX_SLOTS)) {
    if (typeof mentah !== "object" || mentah === null) continue
    const slot = mentah as Record<string, unknown>
    if (typeof slot.stepId !== "string" || !slot.stepId) continue
    if (!Array.isArray(slot.options)) continue

    const options = slot.options
      .slice(0, MAX_OPTIONS_PER_SLOT)
      .map((o) => (typeof o === "object" && o !== null ? (o as Record<string, unknown>) : null))
      .filter((o): o is Record<string, unknown> => o !== null)
      .filter((o) => typeof o.productId === "number" && o.productId > 0)
      .map((o) => ({
        productId: o.productId as number,
        quantity: typeof o.quantity === "number" && o.quantity > 0 ? (o.quantity as number) : 1,
      }))

    if (options.length === 0) continue
    hasil.push({ stepId: slot.stepId, options })
  }

  return hasil
}

export async function POST(req: NextRequest) {
  try {
    // Endpoint ini ada di /api — di luar jangkauan proxy /admin — dan memakai
    // API key milik sistem. Tanpa pemeriksaan ini, siapa pun yang tahu
    // alamatnya bisa menghabiskan kuota AI atas nama kita.
    await requireAuth()

    const groqApiKey = env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured in the environment variables." },
        { status: 500 }
      )
    }

    const body = (await req.json()) as Record<string, unknown>
    const slots = bacaSlots(body.slots)

    if (slots.length === 0) {
      return NextResponse.json(
        { error: "Paket ini belum punya komponen untuk dianalisis." },
        { status: 400 }
      )
    }

    // Sidik jari dihitung DI SINI, bukan diterima dari klien: ia yang nanti
    // menentukan hasil analisis masih berlaku atau sudah basi, dan nilai yang
    // dikirim klien tidak dijamin dihitung dari komponen yang sama dengan yang
    // baru saja dianalisis.
    const fingerprint = fingerprintSlots(slots)

    const [steps, games] = await Promise.all([getPcBuilderConfig(), getPcPrebuildGames()])
    const namaStep = new Map(steps.map((step) => [step.id, step.name]))

    // Yang dianalisis adalah KOMBINASI BAWAAN — pilihan pertama tiap slot.
    // Paket bercabang di HNS umumnya cuma bercabang pada RAM atau penyimpanan,
    // dan menghitung seluruh kombinasi berarti belasan panggilan AI untuk
    // selisih yang tidak mengubah kelas performanya.
    const bawaan = slots.map((slot) => ({ ...slot.options[0], stepId: slot.stepId }))
    const katalog = await getAnalysisProducts(bawaan.map((o) => o.productId))

    const komponen = bawaan
      .map((option) => {
        const product = katalog.get(option.productId)
        if (!product) return null

        const stepName = namaStep.get(option.stepId) ?? ""
        const role = detectComponentRole(stepName, product.categories[0], product.name)

        return { stepName, role, product, quantity: option.quantity }
      })
      .filter((k): k is NonNullable<typeof k> => k !== null)

    if (komponen.length === 0) {
      return NextResponse.json(
        { error: "Komponen paket ini sudah tidak ada di katalog. Perbarui dulu pilihannya." },
        { status: 422 }
      )
    }

    // Ditolak sebelum memanggil Groq. Analisis atas paket tanpa prosesor atau
    // tanpa RAM cuma bisa jadi karangan, dan karangan itu tersimpan berikut
    // sidik jarinya — jadi ia akan terlihat sah sampai ada yang membacanya.
    const kurang: PrebuildComponentRole[] = missingRequiredRoles(komponen.map((k) => k.role))
    if (kurang.length > 0) {
      return NextResponse.json(
        {
          error: `Lengkapi dulu ${kurang.map((r) => COMPONENT_ROLE_LABELS[r]).join(", ")} sebelum menghitung performa.`,
        },
        { status: 422 }
      )
    }

    const daftarKomponen = komponen
      .map((k) => {
        const kategori = k.product.categories.slice(0, 2).join(" / ")
        const label = k.stepName || COMPONENT_ROLE_LABELS[k.role]
        return `- ${label}${kategori ? ` [kategori: ${kategori}]` : ""}: ${k.product.name} x${k.quantity} (Rp ${k.product.price.toLocaleString("id-ID")})`
      })
      .join("\n")

    const daftarUseCase = PREBUILD_USE_CASES.map((u) => `- ${u.id} = ${u.label}: ${u.description}`).join("\n")
    const daftarTier = PREBUILD_RESOLUTION_TIERS.map((t) => `- ${t.id} = ${t.description}`).join("\n")
    const daftarGame = games.map((g) => `- ${g.id} = ${g.name}`).join("\n")

    const prompt = `Kamu konsultan IT profesional di HNS IT Center Batam yang juga paham cara menjelaskan produk ke calon pembeli awam. Kamu menilai sebuah paket PC rakitan.

KOMPONEN PAKET:
${daftarKomponen}

DAFTAR USE CASE (hanya boleh memakai id di bawah, JANGAN membuat id baru):
${daftarUseCase}

DAFTAR TINGKATAN RESOLUSI (pilih SATU id):
${daftarTier}

DAFTAR GAME (hanya boleh memakai gameId di bawah):
${daftarGame || "(kosong — kembalikan fps sebagai array kosong)"}

ATURAN:
1. Semua teks ditulis dalam Bahasa Indonesia yang wajar, ringkas, dan jujur. Tanpa hiperbola, tanpa tanda seru.
2. "score" use case 0-100, mencerminkan seberapa cocok paket ini untuk kebutuhan itu.
3. "quality" hanya boleh salah satu dari: ${PREBUILD_QUALITY_PRESETS.join(", ")}.
4. Estimasi FPS dibuat pada resolusi 1080p. "quality" tiap game mengikuti setelan yang kamu tulis di "resolution.quality", KECUALI game yang menuntut setelan lebih rendah supaya tetap nyaman — untuk game itu tulis setelan yang benar-benar kamu pakai. "low" adalah 1% low: lazimnya 60-80% dari "avg", dan tidak pernah melebihinya.
5. Masukkan SEMUA game yang masih bisa dijalankan paket ini, walaupun hanya pada setelan rendah. Buang dari daftar fps HANYA game yang benar-benar tidak bisa jalan. Kalau paket ini memang bukan untuk gaming, isi "suitable": false dan jelaskan alasannya di "note" — daftar fps-nya tetap diisi untuk game yang masih sanggup dijalankan.
6. "bottleneck" adalah perkiraan beban relatif 0-100 saat gaming 1080p. Selisih yang lebar berarti satu komponen menahan yang lain; jelaskan dalam satu kalimat di "verdict".
7. Maksimal ${MAX_UPGRADE_SUGGESTIONS} saran upgrade, diurut dari yang paling berdampak. Hanya sebut komponen yang ADA di daftar di atas. "from" WAJIB menggambarkan komponen yang sekarang benar-benar dipakai paket ini — baca ulang daftar komponen di atas sebelum menulisnya, jangan menebak dan jangan menyalin dari contoh. Jangan menyarankan penggantian ke sesuatu yang setara atau lebih rendah. "priority" hanya boleh: tinggi, sedang, rendah.
8. JANGAN menyebut harga, diskon, promo, atau perbandingan harga di teks mana pun. Angka rupiah di atas hanya konteks kelas paket.
9. JANGAN mengarang komponen yang tidak ada di daftar.

Balas HANYA JSON dengan bentuk persis seperti ini. Setiap <…> diganti nilai sebenarnya; JANGAN menyalin teks contohnya:
{"headline":"<satu sampai dua kalimat rangkuman untuk calon pembeli>","resolution":{"tier":"<satu id dari daftar tingkatan resolusi>","quality":"<satu dari ${PREBUILD_QUALITY_PRESETS.join("|")}>"},"useCases":[{"id":"<id use case dari daftar>","score":0}],"gaming":{"suitable":true,"note":"<kosongkan kalau tidak ada yang perlu diperingatkan>","fps":[{"gameId":"<id game dari daftar>","avg":0,"low":0,"quality":"<setelan grafis>"}]},"bottleneck":{"cpu":0,"gpu":0,"verdict":"<satu kalimat>"},"upgrades":[{"component":"<nama komponen>","from":"<keadaan komponen itu SEKARANG menurut daftar di atas>","to":"<usulan penggantinya>","impact":"<satu kalimat dampaknya>","priority":"<tinggi|sedang|rendah>"}]}`

    // Dicegat sebelum memanggil Groq: kalau dibiarkan lewat, yang kembali
    // adalah 413 mentah berisi id organisasi dan tautan penagihan — dan
    // panggilannya tetap terhitung terhadap kuota.
    const fits = checkInputFits(MODEL, prompt, MAX_TOKENS)
    if (!fits.ok) {
      return NextResponse.json(
        {
          error: `Daftar komponennya terlalu panjang untuk dianalisis sekaligus (sekitar ${fits.estimated.toLocaleString("id-ID")} token, batas ${fits.budget.toLocaleString("id-ID")}).`,
        },
        { status: 413 }
      )
    }

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

    // Jawaban yang terpotong di tengah bukan JSON yang sah. Ditangkap di sini
    // supaya pesannya jelas, bukan muncul sebagai "JSON tidak valid".
    if (choice?.finish_reason === "length") {
      return NextResponse.json(
        { error: "Jawaban AI terpotong. Kurangi jumlah game di daftar, lalu coba lagi." },
        { status: 422 }
      )
    }

    let mentah: unknown
    try {
      mentah = JSON.parse(choice?.message?.content || "")
    } catch {
      return NextResponse.json(
        { error: "Balasan AI tidak bisa dibaca. Coba jalankan sekali lagi." },
        { status: 502 }
      )
    }

    // Parser yang SAMA dengan yang dipakai saat membaca dari database. Jawaban
    // model diperlakukan persis seperti data asing lain: id di luar katalog
    // dibuang, angka dijepit, teks dipotong. Yang ditambahkan di sini hanya dua
    // hal yang tidak boleh datang dari model — sidik jari komponen dan waktu
    // pembuatannya.
    const performance = parsePrebuildPerformance({
      ...(typeof mentah === "object" && mentah !== null ? mentah : {}),
      fingerprint,
      generatedAt: new Date().toISOString(),
      // Selalu draf. Yang memutuskan sebuah perkiraan layak dilihat pelanggan
      // adalah staff, bukan model yang membuatnya.
      published: false,
    })

    if (!performance) {
      return NextResponse.json(
        { error: "Hasil AI tidak lengkap (tingkatan resolusinya tidak dikenali). Coba lagi." },
        { status: 502 }
      )
    }

    return NextResponse.json({ performance })
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

    console.error("PC Prebuild performance error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: `Gagal menghitung performa: ${message}` }, { status: 500 })
  }
}
