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
import { MAX_ITEMS_PER_SLOT } from "@/lib/pc-prebuild/limits"
import {
  PREBUILD_FPS_QUALITIES,
  PREBUILD_FPS_RESOLUTIONS,
  PREBUILD_QUALITY_PRESETS,
  PREBUILD_RESOLUTION_TIERS,
  PREBUILD_USE_CASES,
  fingerprintSlots,
  parsePrebuildPerformance,
} from "@/lib/pc-prebuild/performance"

/**
 * Menghitung perkiraan performa satu paket PC Prebuild lewat Groq.
 *
 * Yang dihasilkan: kelas resolusi, kecocokan per use case, matriks estimasi
 * FPS, dan perkiraan keseimbangan CPU/GPU. **Satu panggilan, satu model.**
 *
 * ## Saran upgrade SENGAJA tidak ada — jangan ditambahkan kembali
 *
 * Endpoint ini sempat punya panggilan KEDUA (`openai/gpt-oss-20b`) yang memilih
 * produk pengganti dari kandidat katalog untuk melengkapi daftar saran upgrade.
 * Seluruhnya dibuang 26 Agustus 2026 atas keputusan pemilik produk: yang
 * mengunggah produk di HNS sudah berkompeten menilai kelas komponen, jadi saran
 * mesin di atas penilaian mereka tidak menambah apa pun — sementara saran yang
 * meleset tetap harus ditolak CS di depan pelanggan.
 *
 * Efek sampingnya menguntungkan: seluruh jatah token panggilan kedua kembali,
 * dan `max_tokens` panggilan pertama tidak perlu lagi berbagi jatah semenit.
 *
 * ## `bottleneck` UNTUK PANEL ADMIN SAJA
 *
 * Ia tetap dihitung dan tetap tersimpan, tapi halaman pelanggan tidak boleh
 * merendernya (keputusan yang sama, 26 Agustus 2026). Bagi pembeli, "CPU 78 /
 * GPU 91" bukan informasi yang bisa ditindaklanjuti; bagi staff yang sedang
 * menyusun paket, ia justru penanda paling cepat bahwa ada komponen yang
 * menahan yang lain.
 *
 * ## Kenapa BUKAN `groq/compound`, meski TPM-nya terlihat 70.000
 *
 * `groq/compound` bukan model melainkan ROUTER: ia memanggil model lain di
 * dalamnya (`meta-llama/llama-4-scout`, lalu `openai/gpt-oss-120b`). Header
 * `x-ratelimit-limit-tokens` di endpoint compound memang membalas 70.000, tapi
 * yang benar-benar mengikat adalah TPM model DI DALAMNYA — diukur 26 Agustus
 * 2026, permintaan seukuran prompt ini langsung ditolak:
 *
 *     429 Rate limit reached for model `meta-llama/llama-4-scout-17b-16e-instruct`
 *         … tokens per minute (TPM): Limit 30000, Used 27359, Requested 13501
 *
 * Perhatikan `Requested 13501` untuk permintaan yang isinya 1.255 token input
 * dan `max_tokens` 8.000: router itu menggandakan pemakaian karena menjalankan
 * beberapa model internal. Catatan lama di berkas ini juga sudah mencatat
 * compound membalas 413 "Request Entity Too Large" pada prompt sebesar ini.
 *
 * ## Yang benar-benar memecahkan soal token: SKEMA JSON, bukan modelnya
 *
 * Matriksnya `game × 3 resolusi × 3 setelan` — dua belas game berarti 108 baris
 * FPS. Dengan kunci panjang (`gameId`/`resolution`/`quality`/`avg`/`low`) itu di
 * luar jangkauan. Dengan kunci pendek (`g`/`r`/`q`/`a`/`l`) ia muat dengan
 * lapang. Diukur pada paket tujuh komponen dan dua belas game:
 *
 *     prompt 672 token, keluaran 2.836 token (52 penalaran), 5,9 detik
 *     108 dari 108 sel terisi, finish_reason "stop", JSON sah
 *
 * Kuncinya tetap EKSPLISIT, bukan array berurutan tanpa nama. Array berurutan
 * memang lebih hemat lagi, tapi model yang menukar urutan menghasilkan angka
 * yang salah secara diam-diam — dan angka FPS yang salah tidak punya gejala
 * apa pun sampai ada pelanggan yang mengeluh.
 */
const MODEL = "openai/gpt-oss-120b"

/**
 * Penalaran rendah — dan itu keputusan yang sempat terbalik.
 *
 * Pada percobaan pertama `low` terlihat lebih buruk: ia membuang Red Dead
 * Redemption 2 dari daftar FPS dan menulis "RAM 8 GB single channel" untuk
 * paket yang jelas-jelas sudah 16 GB dual channel. Dua-duanya ternyata BUKAN
 * soal penalaran, melainkan cacat prompt: contoh JSON dulu berisi nilai yang
 * terlihat masuk akal, dan model menyalinnya sebagai fakta alih-alih membaca
 * daftar komponen. Setelah contohnya diganti placeholder, `low` menghasilkan
 * mutu setara `medium` dengan sepertiga token.
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
 * sama persis menghasilkan angka yang berbeda jauh — dan staff kehilangan
 * alasan untuk mempercayai angka mana pun. 0,2 cukup rapat untuk itu.
 */
const TEMPERATURE = 0.2

/**
 * Keluaran terukur untuk matriks penuh: 2.836 token. 4.000 memberi kelonggaran
 * untuk paket berkomponen banyak tanpa memakan jatah semenit habis sekaligus.
 *
 * Jangan dinaikkan tanpa mengukur: `max_tokens` DIPESAN di muka terhadap TPM
 * (8.000 untuk model ini), jadi menaikkannya justru MEMPERSEMPIT daftar
 * komponen yang masih boleh dikirim.
 */
const MAX_TOKENS = 4000

/** Jaring pengaman bentuk badan permintaan; paket nyata jauh di bawah ini. */
const MAX_SLOTS = 24

type ItemMasuk = { productId: number; variationId?: number; quantity: number }
type SlotMasuk = { stepId: string; items: ItemMasuk[] }

function bacaSlots(value: unknown): SlotMasuk[] {
  if (!Array.isArray(value)) return []

  const hasil: SlotMasuk[] = []

  for (const mentah of value.slice(0, MAX_SLOTS)) {
    if (typeof mentah !== "object" || mentah === null) continue
    const slot = mentah as Record<string, unknown>
    if (typeof slot.stepId !== "string" || !slot.stepId) continue
    if (!Array.isArray(slot.items)) continue

    const items = slot.items
      .slice(0, MAX_ITEMS_PER_SLOT)
      .map((o) => (typeof o === "object" && o !== null ? (o as Record<string, unknown>) : null))
      .filter((o): o is Record<string, unknown> => o !== null)
      .filter((o) => typeof o.productId === "number" && o.productId > 0)
      .map((o) => ({
        productId: o.productId as number,
        ...(typeof o.variationId === "number" && o.variationId > 0
          ? { variationId: o.variationId as number }
          : {}),
        quantity: typeof o.quantity === "number" && o.quantity > 0 ? (o.quantity as number) : 1,
      }))

    if (items.length === 0) continue
    hasil.push({ stepId: slot.stepId, items })
  }

  return hasil
}

/** Angka aman dari jawaban model. */
function angka(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/**
 * Bentuk padat dari model → bentuk yang dimengerti `parsePrebuildPerformance`.
 *
 * Pemetaannya SATU ARAH dan tinggal di sini saja: yang tersimpan dan yang
 * dibaca halaman selalu bentuk panjang. Kunci pendek adalah urusan kabel antara
 * kita dan Groq, bukan bentuk data.
 */
function padatKePanjang(mentah: unknown): Record<string, unknown> {
  const raw = typeof mentah === "object" && mentah !== null ? (mentah as Record<string, unknown>) : {}

  const fpsRaw = Array.isArray(raw.fps) ? raw.fps : []
  const fps = fpsRaw
    .map((f) => (typeof f === "object" && f !== null ? (f as Record<string, unknown>) : null))
    .filter((f): f is Record<string, unknown> => f !== null)
    .map((f) => ({
      gameId: typeof f.g === "string" ? f.g : "",
      resolution: typeof f.r === "string" ? f.r : "",
      quality: typeof f.q === "string" ? f.q : "",
      avg: angka(f.a),
      low: angka(f.l),
    }))

  const gaming = typeof raw.gaming === "object" && raw.gaming !== null ? (raw.gaming as Record<string, unknown>) : {}

  return {
    headline: raw.headline,
    resolution: { tier: raw.tier, quality: raw.quality },
    useCases: raw.useCases,
    gaming: { suitable: gaming.suitable, note: gaming.note, fps },
    bottleneck: raw.bottleneck,
  }
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

    // SELURUH barang dianalisis — semuanya memang terpasang bersamaan. Yang
    // TIDAK ikut adalah `alternatives`: itu pilihan tukar, dan menganalisis
    // seluruh kombinasinya berarti belasan panggilan AI untuk selisih yang
    // tidak mengubah kelas performa paket.
    const barang = slots.flatMap((slot) => slot.items.map((item) => ({ ...item, stepId: slot.stepId })))

    // Yang diminta id INDUKNYA, bukan variannya: kategori dan nama yang
    // menjelaskan komponen menempel di induk. Baris VARIATION biasanya cuma
    // mengulang nama induk plus satu nilai atribut, dan kategorinya sering
    // kosong — dua-duanya justru bagian yang paling menolong model mengenali
    // komponen.
    const katalog = await getAnalysisProducts(barang.map((b) => b.productId))

    const komponen = barang
      .map((item) => {
        const product = katalog.get(item.productId)
        if (!product) return null

        const stepName = namaStep.get(item.stepId) ?? ""
        const role = detectComponentRole(stepName, product.categories[0], product.name)

        return { stepId: item.stepId, stepName, role, product, quantity: item.quantity }
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
        return `- [${k.role}] ${label}${kategori ? ` (${kategori})` : ""}: ${k.product.name} x${k.quantity} — Rp ${k.product.price.toLocaleString("id-ID")}`
      })
      .join("\n")

    const daftarUseCase = PREBUILD_USE_CASES.map((u) => `- ${u.id} = ${u.label}: ${u.description}`).join("\n")
    const daftarTier = PREBUILD_RESOLUTION_TIERS.map((t) => `- ${t.id} = ${t.description}`).join("\n")
    const daftarGame = games.map((g) => `- ${g.id} = ${g.name}`).join("\n")

    const prompt = `Kamu konsultan IT profesional di HNS IT Center Batam yang juga paham cara menjelaskan produk ke calon pembeli awam. Kamu menilai sebuah paket PC rakitan.

KOMPONEN PAKET (tanda kurung siku di depan adalah PERAN komponen):
${daftarKomponen}

DAFTAR USE CASE (hanya boleh memakai id di bawah, JANGAN membuat id baru):
${daftarUseCase}

DAFTAR TINGKATAN RESOLUSI (pilih SATU id untuk "tier"):
${daftarTier}

DAFTAR GAME (hanya boleh memakai id di bawah):
${daftarGame || "(kosong — kembalikan fps sebagai array kosong)"}

ATURAN:
1. Semua teks ditulis dalam Bahasa Indonesia yang wajar, ringkas, dan jujur. Tanpa hiperbola, tanpa tanda seru.
2. "score" use case 0-100, mencerminkan seberapa cocok paket ini untuk kebutuhan itu.
3. "quality" di tingkat atas hanya boleh salah satu dari: ${PREBUILD_QUALITY_PRESETS.join(", ")}. Itu vonis kelas paket secara keseluruhan.
4. MATRIKS FPS — ini bagian terpenting. Untuk SETIAP game di daftar, isi SEMUA ${PREBUILD_FPS_RESOLUTIONS.length * PREBUILD_FPS_QUALITIES.length} kombinasi: "r" salah satu dari ${PREBUILD_FPS_RESOLUTIONS.join("/")} dan "q" salah satu dari ${PREBUILD_FPS_QUALITIES.join("/")}. Jadi ${PREBUILD_FPS_RESOLUTIONS.length * PREBUILD_FPS_QUALITIES.length} baris per game, tanpa ada yang dilewati.
5. "a" adalah FPS rata-rata, "l" adalah 1% low. "l" lazimnya 60-80% dari "a" dan TIDAK PERNAH melebihinya. Angkanya harus turun secara masuk akal saat resolusi naik dan saat setelan naik.
6. Masukkan SEMUA game, walaupun hanya sanggup pada setelan rendah — tulis angka apa adanya, termasuk kalau di bawah 30. Kalau paket ini memang bukan untuk gaming, isi "gaming":{"suitable":false,...} dan jelaskan alasannya di "note"; matriksnya TETAP diisi.
7. "bottleneck" adalah perkiraan beban relatif 0-100 saat gaming 1080p — WAJIB diisi angka sebenarnya, bukan nol. Selisih yang lebar berarti satu komponen menahan yang lain; jelaskan dalam satu kalimat di "verdict".
8. JANGAN menyebut harga, diskon, promo, atau perbandingan harga di teks mana pun. Angka rupiah di atas hanya konteks kelas paket.
9. JANGAN mengarang komponen yang tidak ada di daftar.

Balas HANYA JSON dengan bentuk persis seperti ini, memakai kunci pendek. Setiap <…> diganti nilai sebenarnya; JANGAN menyalin teks contohnya:
{"headline":"<satu sampai dua kalimat rangkuman untuk calon pembeli>","tier":"<satu id dari daftar tingkatan resolusi>","quality":"<satu dari ${PREBUILD_QUALITY_PRESETS.join("|")}>","useCases":[{"id":"<id use case dari daftar>","score":0}],"gaming":{"suitable":true,"note":"<kosongkan kalau tidak ada yang perlu diperingatkan>"},"fps":[{"g":"<id game>","r":"<${PREBUILD_FPS_RESOLUTIONS.join("|")}>","q":"<${PREBUILD_FPS_QUALITIES.join("|")}>","a":0,"l":0}],"bottleneck":{"cpu":0,"gpu":0,"verdict":"<satu kalimat>"}}`

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

    const panjang = padatKePanjang(mentah)

    // Parser yang SAMA dengan yang dipakai saat membaca dari database. Jawaban
    // model diperlakukan persis seperti data asing lain: id di luar katalog
    // dibuang, angka dijepit, teks dipotong. Yang ditambahkan di sini hanya dua
    // hal yang tidak boleh datang dari model — sidik jari komponen dan waktu
    // pembuatannya.
    const performance = parsePrebuildPerformance({
      ...panjang,
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