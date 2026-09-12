/**
 * Hasil analisis performa satu paket PC Prebuild — bentuk data, katalog tetap,
 * dan parsernya.
 *
 * Berkas ini SENGAJA tidak mengimpor apa pun kecuali `limits.ts` (yang juga
 * tidak mengimpor apa pun). Panel admin dan panel publik dua-duanya Client
 * Component dan keduanya butuh katalog di bawah; mengimpornya dari `config.ts`
 * akan menyeret `getPrisma()` ke bundle browser dan menggagalkan build
 * Turbopack (lihat docs/11-pc-prebuild.md §7).
 *
 * ## Kenapa katalognya TETAP, bukan bebas dari AI
 *
 * Use case, tingkatan resolusi, setelan grafis, dan sumbu matriks FPS adalah
 * daftar tertutup yang ditetapkan di sini; AI hanya MEMILIH dari daftar ini dan
 * memberi skor. Kalau labelnya boleh dikarang tiap kali dihitung, dua paket
 * sekelas bisa berbunyi "1440p Ultra" dan "QHD High" — pelanggan tidak bisa
 * membandingkan paket, dan badge di kartu kehilangan artinya sebagai penanda.
 * Id yang tidak dikenal DIBUANG parser, bukan ditampilkan apa adanya.
 *
 * ## Angka di sini adalah PERKIRAAN, bukan janji
 *
 * Seluruh isinya draf yang boleh diedit staff sebelum ditayangkan, dan
 * `published` bawaannya `false`. Ini bukan harga — jadi bukan wilayah CLAUDE.md
 * §2.7 — tapi semangatnya sama: yang sampai ke pelanggan harus sesuatu yang
 * bisa dipertanggungjawabkan HNS, bukan angka yang muncul begitu saja dari
 * sebuah model.
 */
/** Bagian tetap: kebutuhan pemakai yang diskor AI, 0-100. */
export const PREBUILD_USE_CASES = [
  {
    id: "competitive-gaming",
    label: "Gaming Kompetitif",
    description: "Esports 1080p — yang dikejar FPS tinggi dan stabil.",
  },
  {
    id: "aaa-gaming",
    label: "Gaming AAA",
    description: "Game berat grafis tinggi, dunia terbuka.",
  },
  {
    id: "streaming",
    label: "Live Streaming",
    description: "Main sambil siaran ke Twitch/YouTube.",
  },
  {
    id: "video-editing",
    label: "Editing Video",
    description: "Timeline 1080p sampai 4K, render.",
  },
  {
    id: "render-3d",
    label: "3D Render & Desain",
    description: "Blender, AutoCAD, SolidWorks.",
  },
  {
    id: "office",
    label: "Kerja Kantor",
    description: "Office, browser banyak tab, rapat daring.",
  },
  {
    id: "programming",
    label: "Programming & Dev",
    description: "IDE, container, kompilasi.",
  },
] as const

export type PrebuildUseCaseId = (typeof PREBUILD_USE_CASES)[number]["id"]

const USE_CASE_IDS = new Set<string>(PREBUILD_USE_CASES.map((u) => u.id))

/**
 * Tingkatan resolusi — inilah yang jadi badge kelas paket.
 *
 * `office` ada supaya paket yang memang bukan untuk game tidak dipaksa memakai
 * angka resolusi yang menyesatkan. Labelnya sengaja pendek: badge cuma muat
 * beberapa karakter.
 */
export const PREBUILD_RESOLUTION_TIERS = [
  { id: "office", label: "Office", description: "Untuk kerja dan multimedia, bukan game berat." },
  { id: "720p", label: "720p", description: "Game ringan pada setelan rendah." },
  { id: "1080p", label: "1080p", description: "Full HD — titik paling umum untuk gaming." },
  { id: "1440p", label: "1440p", description: "2K — layar tajam dengan setelan tinggi." },
  { id: "4k", label: "4K", description: "Ultra HD, kelas paling berat." },
] as const

export type PrebuildResolutionTierId = (typeof PREBUILD_RESOLUTION_TIERS)[number]["id"]

const RESOLUTION_TIER_IDS = new Set<string>(PREBUILD_RESOLUTION_TIERS.map((t) => t.id))

/** Setelan grafis untuk vonis kelas paket. Tetap, dengan alasan yang sama. */
export const PREBUILD_QUALITY_PRESETS = ["Low", "Medium", "High", "Ultra"] as const

export type PrebuildQuality = (typeof PREBUILD_QUALITY_PRESETS)[number]

const QUALITY_VALUES = new Set<string>(PREBUILD_QUALITY_PRESETS)

/* ------------------------------------------------------------------------- *
 * Matriks FPS
 * ------------------------------------------------------------------------- */

/**
 * Sumbu matriks estimasi FPS: 3 resolusi × 3 setelan = 9 kombinasi per game.
 *
 * Sebelumnya hanya ADA SATU patokan (1080p, setelan disebut per baris). Itu
 * membuat angka antar paket bisa dibandingkan, tapi tidak menjawab pertanyaan
 * yang sebenarnya diajukan pembeli: "kalau saya turunkan ke 720p Low, cukup
 * tidak?". Matriksnya menjawab itu tanpa kehilangan sifat terbandingkan —
 * karena sumbunya TETAP, bukan dikarang model per paket.
 *
 * TIGA resolusi, bukan empat. 4K sengaja tidak masuk: pada paket yang sanggup
 * 4K, angkanya sudah bisa disimpulkan dari 1440p, dan setiap kombinasi tambahan
 * mengalikan jumlah angka yang harus dikeluarkan model untuk SETIAP game.
 */
export const PREBUILD_FPS_RESOLUTIONS = ["720p", "1080p", "1440p"] as const

export type PrebuildFpsResolution = (typeof PREBUILD_FPS_RESOLUTIONS)[number]

const FPS_RESOLUTION_VALUES = new Set<string>(PREBUILD_FPS_RESOLUTIONS)

/**
 * Setelan grafis di matriks — TANPA "Ultra".
 *
 * Sengaja subset dari `PREBUILD_QUALITY_PRESETS` (jadi tetap assignable ke
 * `PrebuildQuality`). "Ultra" tetap sah sebagai vonis kelas paket, tapi sebagai
 * sumbu matriks ia menambah tiga kombinasi lagi per game untuk perbedaan yang
 * di banyak game tidak terasa dibanding "High".
 */
export const PREBUILD_FPS_QUALITIES = ["Low", "Medium", "High"] as const

export type PrebuildFpsQuality = (typeof PREBUILD_FPS_QUALITIES)[number]

const FPS_QUALITY_VALUES = new Set<string>(PREBUILD_FPS_QUALITIES)

/**
 * Patokan untuk data LAMA yang tidak menyimpan resolusi.
 *
 * Versi pertama fitur ini memakai satu patokan tetap 1080p dan menuliskannya di
 * dokumentasi. Entri lama karena itu dibaca sebagai 1080p — bukan dibuang, dan
 * bukan pula ditebak dari angkanya.
 */
const DEFAULT_FPS_RESOLUTION: PrebuildFpsResolution = "1080p"

/**
 * ## Saran upgrade SENGAJA tidak ada, dan jangan ditambahkan kembali
 *
 * Versi 24–26 Agustus 2026 sempat punya `upgrades` — daftar komponen yang
 * disarankan diganti, lengkap dengan produk pengganti yang dipilih AI dari
 * katalog lewat panggilan Groq kedua. Seluruhnya dibuang 26 Agustus 2026 atas
 * keputusan pemilik produk.
 *
 * Alasannya bukan teknis: yang mengunggah produk di HNS sudah berkompeten
 * menilai kelas komponen, jadi saran mesin di atas penilaian mereka tidak
 * menambah apa pun — sementara saran yang meleset tetap harus ditolak CS di
 * depan pelanggan. Fitur yang akurasinya tidak bisa dijamin dan gunanya tipis
 * lebih baik tidak ada daripada ada dengan peringatan.
 *
 * Membuangnya juga menghapus panggilan Groq kedua beserta seluruh jatah
 * tokennya.
 */

/** Batas panjang teks, supaya jawaban model yang meleset tidak merusak tata letak. */
const MAX_HEADLINE = 240
const MAX_NOTE = 240
const MAX_VERDICT = 160
const MAX_SHORT_TEXT = 80

/** FPS di atas ini tidak masuk akal untuk PC rakitan mana pun — jelas salah baca. */
const MAX_FPS = 1000

export type PrebuildFpsEntry = {
  /** Menunjuk `id` di daftar game (PC_PREBUILD_GAMES). */
  gameId: string
  /** Sumbu pertama matriks. Data lama tanpa bidang ini dibaca sebagai 1080p. */
  resolution: PrebuildFpsResolution
  /** Sumbu kedua matriks. */
  quality: PrebuildFpsQuality
  /** FPS rata-rata. */
  avg: number
  /** 1% low — angka yang menentukan terasa patah atau tidak. Tidak pernah lebih besar dari `avg`. */
  low: number
}

export type PrebuildPerformance = {
  /**
   * Sidik jari komponen SAAT dihitung. Begitu staff mengganti komponen, sidik
   * jarinya tidak cocok lagi dan hasil ini berhenti ditampilkan ke pelanggan
   * sampai dihitung ulang — lihat `isPerformanceStale`.
   */
  fingerprint: string
  /** ISO 8601. Kosong = tidak diketahui (data lama). */
  generatedAt: string
  /**
   * Sakelar tayang. Bawaannya TERTUTUP: hasil AI selalu masuk sebagai draf,
   * dan staff yang memutuskan ia layak dilihat pelanggan.
   */
  published: boolean
  /** Satu-dua kalimat pembuka, gaya konsultan IT. */
  headline: string
  resolution: { tier: PrebuildResolutionTierId; quality: PrebuildQuality }
  /** Skor 0-100 per use case, urut dari yang paling cocok. */
  useCases: { id: PrebuildUseCaseId; score: number }[]
  gaming: {
    /** `false` = paket ini bukan untuk main game; `note` menjelaskan kenapa. */
    suitable: boolean
    note: string
    /**
     * Matriks perkiraan FPS — satu entri per (game × resolusi × setelan).
     *
     * Tetap diisi untuk game yang MASIH sanggup dijalankan walaupun `suitable`
     * bernilai `false`: pelanggan yang melihat PC kantor tetap ingin tahu
     * Minecraft-nya jalan berapa.
     */
    fps: PrebuildFpsEntry[]
  }
  /**
   * Beban relatif 0-100. Selisih yang lebar = ada komponen yang menahan yang
   * lain.
   *
   * **UNTUK PANEL ADMIN SAJA — jangan dirender di halaman pelanggan.**
   * Keputusan 26 Agustus 2026. Ia alat bantu staff menilai susunan yang sedang
   * dirakit; bagi pembeli, "CPU 78 / GPU 91" bukan informasi yang bisa
   * ditindaklanjuti, dan angka yang terbaca seperti nilai rapor justru membuat
   * paket yang sehat terlihat cacat.
   */
  bottleneck: { cpu: number; gpu: number; verdict: string }
}

/** Bentuk minimal yang dibutuhkan sidik jari — sengaja tidak menuntut tipe preset penuh. */
export type FingerprintItem = {
  productId: number
  variationId?: number
  quantity: number
}

export type FingerprintSlot = {
  stepId: string
  items: readonly FingerprintItem[]
}

/**
 * Sidik jari komponen sebuah paket.
 *
 * URUTAN IKUT DIHITUNG, dan itu disengaja: barang pertama dalam sebuah langkah
 * — dan pilihan pertama dalam sebuah barang — adalah bawaan, jadi menukar
 * urutannya mengubah komponen yang dianalisis walaupun himpunan produknya sama
 * persis.
 *
 * VARIAN IKUT DIHITUNG. Dua paket yang memakai produk induk sama tapi varian
 * berbeda (1 TB vs 2 TB) adalah dua rakitan berbeda, dan analisis yang dihitung
 * untuk salah satunya tidak berlaku untuk yang lain.
 *
 * Berawalan versi supaya kalau formatnya berubah, seluruh hasil lama otomatis
 * dianggap basi dan dihitung ulang — bukan dibandingkan dengan aturan yang
 * sudah tidak berlaku. `v2` menandai pindahnya `options` ke `items` bervarian;
 * seluruh analisis yang dihitung sebelum itu memang perlu dihitung ulang,
 * karena matriks FPS-nya pun berubah bentuk.
 */
export function fingerprintSlots(slots: readonly FingerprintSlot[]): string {
  const bagian = [...slots]
    .sort((a, b) => a.stepId.localeCompare(b.stepId))
    .map((slot) => {
      const items = slot.items
        .map((i) => `${i.productId}${i.variationId ? `~${i.variationId}` : ""}*${i.quantity}`)
        .join(",")
      return `${slot.stepId}:${items}`
    })

  return `v2|${bagian.join("|")}`
}

/** Hasil sudah tidak cocok dengan komponen paket saat ini. */
export function isPerformanceStale(
  performance: PrebuildPerformance | null | undefined,
  slots: readonly FingerprintSlot[]
): boolean {
  if (!performance) return false
  return performance.fingerprint !== fingerprintSlots(slots)
}

/**
 * Boleh dilihat pelanggan?
 *
 * Dua syarat, dan keduanya dijalankan di server sebelum data dikirim ke
 * browser: staff sudah menayangkannya, DAN komponennya belum berubah sejak
 * dihitung. Analisis basi lebih buruk daripada tidak ada analisis — ia
 * menjelaskan PC yang bukan lagi PC yang sedang dilihat.
 */
export function isPerformanceVisible(
  performance: PrebuildPerformance | null | undefined,
  slots: readonly FingerprintSlot[]
): performance is PrebuildPerformance {
  if (!performance || !performance.published) return false
  return !isPerformanceStale(performance, slots)
}

function teks(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

/** Angka bulat yang dijepit ke rentang. Bukan angka = `min`. */
function jepit(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

function toUseCase(value: unknown): { id: PrebuildUseCaseId; score: number } | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>
  // Id di luar katalog DIBUANG. Inilah yang menahan AI mengarang kategori baru
  // setiap kali dihitung — lihat catatan di kepala berkas.
  if (typeof raw.id !== "string" || !USE_CASE_IDS.has(raw.id)) return null
  return { id: raw.id as PrebuildUseCaseId, score: jepit(raw.score, 0, 100) }
}

/**
 * Setelan grafis untuk matriks.
 *
 * "Ultra" dari data lama JATUH ke "High", bukan dibuang: sumbu matriks tidak
 * mengenal Ultra, dan membuang barisnya berarti kehilangan angka yang sudah
 * pernah dihitung untuk game itu.
 */
function toFpsQuality(value: unknown): PrebuildFpsQuality {
  const quality = teks(value, MAX_SHORT_TEXT)
  if (FPS_QUALITY_VALUES.has(quality)) return quality as PrebuildFpsQuality
  if (quality === "Ultra") return "High"
  return "Medium"
}

function toFps(value: unknown): PrebuildFpsEntry | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>
  const gameId = teks(raw.gameId, MAX_SHORT_TEXT)
  if (!gameId) return null

  const resolution = teks(raw.resolution, MAX_SHORT_TEXT)
  const avg = jepit(raw.avg, 0, MAX_FPS)
  // `low` yang lebih tinggi dari rata-rata mustahil — dijepit, bukan dibuang,
  // supaya satu angka meleset tidak menghilangkan seluruh baris game.
  const low = Math.min(jepit(raw.low, 0, MAX_FPS), avg)

  return {
    gameId,
    resolution: FPS_RESOLUTION_VALUES.has(resolution)
      ? (resolution as PrebuildFpsResolution)
      : DEFAULT_FPS_RESOLUTION,
    quality: toFpsQuality(raw.quality),
    avg,
    low,
  }
}

/**
 * Bentuk mentah (dari kolom JSON `settings` MAUPUN dari jawaban Groq) → bentuk
 * yang aman dipakai. Satu parser untuk dua sumber, supaya tidak ada jalur yang
 * bisa menitipkan bentuk lain ke penyimpanan.
 *
 * `null` = paket ini belum punya analisis. Yang bikin gugur cuma dua: sidik
 * jari kosong dan tingkatan resolusi yang tidak dikenal — sisanya diperbaiki
 * seadanya, karena kehilangan seluruh analisis gara-gara satu baris saran yang
 * cacat jauh lebih merugikan daripada kehilangan baris itu saja.
 */
export function parsePrebuildPerformance(value: unknown): PrebuildPerformance | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>

  const fingerprint = teks(raw.fingerprint, 2000)
  if (!fingerprint) return null

  const resolusi =
    typeof raw.resolution === "object" && raw.resolution !== null
      ? (raw.resolution as Record<string, unknown>)
      : null
  const tier = teks(resolusi?.tier, MAX_SHORT_TEXT)
  if (!RESOLUTION_TIER_IDS.has(tier)) return null

  const quality = teks(resolusi?.quality, MAX_SHORT_TEXT)

  const useCasesRaw = Array.isArray(raw.useCases) ? raw.useCases : []
  const sudahAda = new Set<string>()
  const useCases = useCasesRaw
    .map(toUseCase)
    .filter((u): u is { id: PrebuildUseCaseId; score: number } => u !== null)
    .filter((u) => {
      if (sudahAda.has(u.id)) return false
      sudahAda.add(u.id)
      return true
    })
    .sort((a, b) => b.score - a.score)

  const gamingRaw =
    typeof raw.gaming === "object" && raw.gaming !== null
      ? (raw.gaming as Record<string, unknown>)
      : {}

  const fpsRaw = Array.isArray(gamingRaw.fps) ? gamingRaw.fps : []
  const selKeisi = new Set<string>()
  const fps = fpsRaw
    .map(toFps)
    .filter((f): f is PrebuildFpsEntry => f !== null)
    .filter((f) => {
      // Satu SEL matriks satu baris — kuncinya (game × resolusi × setelan),
      // bukan lagi game saja. Entri untuk game yang sudah dihapus staff dari
      // daftar disaring belakangan saat dirender: parser ini tidak tahu daftar
      // game yang berlaku, dan membuangnya di sini berarti hasilnya hilang
      // permanen begitu staff menyembunyikan satu game sementara.
      const kunci = `${f.gameId}|${f.resolution}|${f.quality}`
      if (selKeisi.has(kunci)) return false
      selKeisi.add(kunci)
      return true
    })

  const bottleneckRaw =
    typeof raw.bottleneck === "object" && raw.bottleneck !== null
      ? (raw.bottleneck as Record<string, unknown>)
      : {}

  return {
    fingerprint,
    generatedAt: teks(raw.generatedAt, 40),
    // Bawaannya TERTUTUP, sama seperti `enabled` pada konfigurasi paket.
    // Jawaban Groq tidak pernah memuat bidang ini, jadi hasil yang baru
    // dihitung selalu mendarat sebagai draf.
    published: raw.published === true,
    headline: teks(raw.headline, MAX_HEADLINE),
    resolution: {
      tier: tier as PrebuildResolutionTierId,
      quality: QUALITY_VALUES.has(quality) ? (quality as PrebuildQuality) : "Medium",
    },
    useCases,
    gaming: {
      suitable: gamingRaw.suitable !== false,
      note: teks(gamingRaw.note, MAX_NOTE),
      fps,
    },
    bottleneck: {
      cpu: jepit(bottleneckRaw.cpu, 0, 100),
      gpu: jepit(bottleneckRaw.gpu, 0, 100),
      verdict: teks(bottleneckRaw.verdict, MAX_VERDICT),
    },
  }
}

/**
 * Cari satu sel matriks. `null` = kombinasi itu tidak dihitung model.
 *
 * Dipakai chart dan panel: keduanya harus membedakan "0 FPS" (tidak jalan) dari
 * "tidak ada datanya" — menggambar batang nol untuk sel yang tidak dihitung
 * membuat paket terlihat tidak sanggup padahal sekadar tidak ditanyakan.
 */
export function findFpsEntry(
  fps: readonly PrebuildFpsEntry[],
  gameId: string,
  resolution: PrebuildFpsResolution,
  quality: PrebuildFpsQuality
): PrebuildFpsEntry | null {
  return (
    fps.find((f) => f.gameId === gameId && f.resolution === resolution && f.quality === quality) ??
    null
  )
}
