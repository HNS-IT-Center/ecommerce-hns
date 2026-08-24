/**
 * Hasil analisis performa satu paket PC Prebuild — bentuk data, katalog tetap,
 * dan parsernya.
 *
 * Berkas ini SENGAJA tidak mengimpor apa pun, seperti `limits.ts`. Panel admin
 * dan panel publik dua-duanya Client Component, dan keduanya butuh katalog di
 * bawah. Mengimpornya dari `config.ts` akan menyeret `getPrisma()` ke bundle
 * browser dan menggagalkan build Turbopack (lihat docs/11-pc-prebuild.md §7).
 *
 * ## Kenapa katalognya TETAP, bukan bebas dari AI
 *
 * Use case dan tingkatan resolusi adalah daftar tertutup yang ditetapkan di
 * sini; AI hanya MEMILIH dari daftar ini dan memberi skor. Kalau labelnya boleh
 * dikarang tiap kali dihitung, dua paket sekelas bisa berbunyi "1440p Ultra"
 * dan "QHD High", atau "Gaming Kompetitif" dan "Esports" — pelanggan tidak bisa
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
 * Tingkatan resolusi — inilah yang jadi badge pita di atas foto paket, sejajar
 * dengan flag diskon di kartu produk.
 *
 * `office` ada supaya paket yang memang bukan untuk game tidak dipaksa memakai
 * angka resolusi yang menyesatkan. Labelnya sengaja pendek: badge pita cuma
 * muat beberapa karakter.
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

/** Setelan grafis. Tetap juga, dengan alasan yang sama seperti tingkatan resolusi. */
export const PREBUILD_QUALITY_PRESETS = ["Low", "Medium", "High", "Ultra"] as const

export type PrebuildQuality = (typeof PREBUILD_QUALITY_PRESETS)[number]

const QUALITY_VALUES = new Set<string>(PREBUILD_QUALITY_PRESETS)

export const PREBUILD_UPGRADE_PRIORITIES = ["tinggi", "sedang", "rendah"] as const

export type PrebuildUpgradePriority = (typeof PREBUILD_UPGRADE_PRIORITIES)[number]

const PRIORITY_VALUES = new Set<string>(PREBUILD_UPGRADE_PRIORITIES)

/**
 * Empat saran cukup. Lebih dari itu daftarnya berhenti terbaca sebagai saran
 * dan berubah jadi katalog — dan saran kelima dari sebuah perkiraan hampir
 * selalu sudah di luar yang bisa dipertanggungjawabkan.
 */
export const MAX_UPGRADE_SUGGESTIONS = 4

/** Batas panjang teks, supaya jawaban model yang meleset tidak merusak tata letak. */
const MAX_HEADLINE = 240
const MAX_NOTE = 240
const MAX_VERDICT = 160
const MAX_SHORT_TEXT = 80
const MAX_IMPACT = 140

/** FPS di atas ini tidak masuk akal untuk PC rakitan mana pun — jelas salah baca. */
const MAX_FPS = 1000

export type PrebuildFpsEntry = {
  /** Menunjuk `id` di daftar game (PC_PREBUILD_GAMES). */
  gameId: string
  /** FPS rata-rata. */
  avg: number
  /** 1% low — angka yang menentukan terasa patah atau tidak. Tidak pernah lebih besar dari `avg`. */
  low: number
  quality: PrebuildQuality
}

export type PrebuildUpgrade = {
  /** Komponen yang disarankan diganti, mis. "RAM". */
  component: string
  /** Keadaan sekarang, mis. "8 GB single channel". */
  from: string
  /** Usulannya, mis. "16 GB dual channel". */
  to: string
  /** Dampaknya dalam satu kalimat. */
  impact: string
  priority: PrebuildUpgradePriority
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
     * Perkiraan FPS. Tetap diisi untuk game yang MASIH sanggup dijalankan
     * walaupun `suitable` bernilai `false` — pelanggan yang melihat PC kantor
     * tetap ingin tahu Minecraft-nya jalan berapa.
     */
    fps: PrebuildFpsEntry[]
  }
  /** Beban relatif 0-100. Selisih yang lebar = ada komponen yang menahan yang lain. */
  bottleneck: { cpu: number; gpu: number; verdict: string }
  upgrades: PrebuildUpgrade[]
}

/** Bentuk minimal yang dibutuhkan sidik jari — sengaja tidak menuntut tipe preset penuh. */
export type FingerprintSlot = {
  stepId: string
  options: readonly { productId: number; quantity: number }[]
}

/**
 * Sidik jari komponen sebuah paket.
 *
 * URUTAN PILIHAN IKUT DIHITUNG, dan itu disengaja: pilihan pertama adalah
 * bawaan, jadi menukar urutannya mengubah komponen yang dianalisis walaupun
 * himpunan produknya sama persis.
 *
 * Berawalan versi supaya kalau formatnya berubah nanti, seluruh hasil lama
 * otomatis dianggap basi dan dihitung ulang — bukan dibandingkan dengan aturan
 * yang sudah tidak berlaku.
 */
export function fingerprintSlots(slots: readonly FingerprintSlot[]): string {
  const bagian = [...slots]
    .sort((a, b) => a.stepId.localeCompare(b.stepId))
    .map(
      (slot) =>
        `${slot.stepId}:${slot.options.map((o) => `${o.productId}*${o.quantity}`).join(",")}`
    )

  return `v1|${bagian.join("|")}`
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

function toFps(value: unknown): PrebuildFpsEntry | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>
  const gameId = teks(raw.gameId, MAX_SHORT_TEXT)
  if (!gameId) return null

  const avg = jepit(raw.avg, 0, MAX_FPS)
  // `low` yang lebih tinggi dari rata-rata mustahil — dijepit, bukan dibuang,
  // supaya satu angka meleset tidak menghilangkan seluruh baris game.
  const low = Math.min(jepit(raw.low, 0, MAX_FPS), avg)
  const quality = teks(raw.quality, MAX_SHORT_TEXT)

  return {
    gameId,
    avg,
    low,
    quality: QUALITY_VALUES.has(quality) ? (quality as PrebuildQuality) : "Medium",
  }
}

function toUpgrade(value: unknown): PrebuildUpgrade | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>

  const component = teks(raw.component, MAX_SHORT_TEXT)
  const to = teks(raw.to, MAX_SHORT_TEXT)
  // Saran tanpa komponen atau tanpa usulan bukan saran. Dibuang di sini supaya
  // panelnya tidak pernah merender baris kosong.
  if (!component || !to) return null

  const priority = teks(raw.priority, MAX_SHORT_TEXT).toLowerCase()

  return {
    component,
    from: teks(raw.from, MAX_SHORT_TEXT),
    to,
    impact: teks(raw.impact, MAX_IMPACT),
    priority: PRIORITY_VALUES.has(priority) ? (priority as PrebuildUpgradePriority) : "sedang",
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
  const gameTerpakai = new Set<string>()
  const fps = fpsRaw
    .map(toFps)
    .filter((f): f is PrebuildFpsEntry => f !== null)
    .filter((f) => {
      // Satu game satu baris. Entri untuk game yang sudah dihapus staff dari
      // daftar disaring belakangan saat dirender — parser ini tidak tahu daftar
      // game yang berlaku, dan membuangnya di sini berarti hasilnya hilang
      // permanen begitu staff menyembunyikan satu game sementara.
      if (gameTerpakai.has(f.gameId)) return false
      gameTerpakai.add(f.gameId)
      return true
    })

  const bottleneckRaw =
    typeof raw.bottleneck === "object" && raw.bottleneck !== null
      ? (raw.bottleneck as Record<string, unknown>)
      : {}

  const upgradesRaw = Array.isArray(raw.upgrades) ? raw.upgrades : []

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
    upgrades: upgradesRaw
      .map(toUpgrade)
      .filter((u): u is PrebuildUpgrade => u !== null)
      .slice(0, MAX_UPGRADE_SUGGESTIONS),
  }
}
