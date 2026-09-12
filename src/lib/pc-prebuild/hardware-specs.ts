/**
 * Nama produk katalog → spesifikasi terstruktur.
 *
 * Endpoint analisis dulu mengirim nama retail apa adanya ke Groq —
 * `"VGA GEFORCE RTX 4060 EAGLE OC 8GB"` — dan model harus mengurai sendiri mana
 * chip, mana VRAM, mana merek perakit, sebelum sempat menilai performanya.
 * Uraian itu meleset persis di tempat yang paling menentukan: RTX 3060 8GB dan
 * RTX 3060 12GB bernama nyaris sama tapi berbeda nyata begitu VRAM-nya habis,
 * dan `"16GB (2x8GB)"` menyimpan fakta dual channel yang tidak pernah terbaca.
 *
 * Berkas ini memindahkan pekerjaan itu dari model ke kode. Yang dikirim
 * sekarang sudah berbentuk `RTX 4060, VRAM 8GB` — model tinggal menilai.
 *
 * Sama seperti `limits.ts`, `component-roles.ts`, dan `games.ts`, berkas ini
 * TIDAK mengimpor apa pun: panel admin (Client Component) ikut memakainya, dan
 * impor yang menyentuh Prisma akan menyeretnya ke bundle browser.
 *
 * ## Yang tidak dikenali TIDAK ditebak
 *
 * Setiap fungsi di sini boleh mengembalikan `null`. Nama yang tidak cocok pola
 * mana pun diteruskan ke model apa adanya, bukan dipaksakan ke chip yang
 * "kira-kira mirip" — tebakan salah di lapisan ini tidak punya gejala apa pun,
 * ia cuma menghasilkan angka FPS yang percaya diri untuk kartu yang keliru.
 */

/* ------------------------------------------------------------------------- *
 * Graphics card
 * ------------------------------------------------------------------------- */

export type GpuVendor = "nvidia" | "amd" | "intel"

export type GpuSpec = {
  /** Chip yang sudah dinormalkan — "RTX 4060 Ti", "RX 7600 XT", "Arc A750". */
  chip: string
  vendor: GpuVendor
  /** Kapasitas VRAM dalam GB. 0 = tidak tertulis di nama produk. */
  vramGb: number
}

/**
 * Akhiran ikut ditangkap karena ia MENGUBAH KELAS, bukan sekadar hiasan nama:
 * RTX 4060 dan RTX 4060 Ti berbeda sekitar 20-25%, dan GTX 1660 Super berbeda
 * nyata dari GTX 1660 biasa. Kalau akhirannya hilang, dua kartu berbeda kelas
 * dikirim ke model sebagai kartu yang sama.
 */
const NVIDIA_PATTERN = /\b(rtx|gtx)\s*-?\s*(\d{3,4})\s*(ti\s*super|super|ti)?\b/i
const AMD_PATTERN = /\brx\s*-?\s*(\d{3,4})\s*(xtx|xt|gre)?\b/i
const INTEL_ARC_PATTERN = /\barc\s*-?\s*([ab]\d{3})\b/i

/**
 * Kapasitas VRAM yang benar-benar ada di pasaran.
 *
 * Dipakai sebagai saringan, bukan pemanis: nama produk penuh angka (seri,
 * kecepatan kipas, panjang kartu), dan tanpa daftar ini pola VRAM akan
 * menangkap angka pertama yang kebetulan diikuti huruf G.
 */
const PLAUSIBLE_VRAM_GB = new Set([2, 3, 4, 6, 8, 10, 11, 12, 16, 20, 24, 32])

/**
 * Menangkap "8GB", "8 GB", "12G", dan "O12G" (awalan O milik varian OC ASUS).
 *
 * Dibatasi satu sampai dua digit supaya nomor seri tidak ikut tertangkap —
 * "RTX 4060" tidak punya batas kata di tengah angkanya, jadi "60" tidak lolos.
 */
const VRAM_PATTERN = /\bo?(\d{1,2})\s*g(?:b)?\b/gi

function readVramGb(name: string): number {
  let vram = 0

  for (const match of name.matchAll(VRAM_PATTERN)) {
    const value = Number(match[1])
    // Yang TERAKHIR menang: kapasitas lazim ditulis di ekor nama produk
    // ("... EAGLE OC 8GB"), sementara angka di depan biasanya milik seri.
    if (PLAUSIBLE_VRAM_GB.has(value)) vram = value
  }

  return vram
}

/** Merapikan akhiran jadi satu bentuk: "TI SUPER" dan "ti super" → "Ti Super". */
function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function parseGpuSpec(name: string): GpuSpec | null {
  const vramGb = readVramGb(name)

  const nvidia = name.match(NVIDIA_PATTERN)
  if (nvidia) {
    const suffix = nvidia[3] ? ` ${titleCase(nvidia[3])}` : ""
    return {
      chip: `${nvidia[1].toUpperCase()} ${nvidia[2]}${suffix}`,
      vendor: "nvidia",
      vramGb,
    }
  }

  const amd = name.match(AMD_PATTERN)
  if (amd) {
    const suffix = amd[2] ? ` ${amd[2].toUpperCase()}` : ""
    return { chip: `RX ${amd[1]}${suffix}`, vendor: "amd", vramGb }
  }

  const arc = name.match(INTEL_ARC_PATTERN)
  if (arc) {
    return { chip: `Arc ${arc[1].toUpperCase()}`, vendor: "intel", vramGb }
  }

  return null
}

/* ------------------------------------------------------------------------- *
 * Processor
 * ------------------------------------------------------------------------- */

export type CpuVendor = "intel" | "amd"

export type CpuSpec = {
  /** Chip yang sudah dinormalkan — "Core i5-12400F", "Ryzen 5 5600G". */
  chip: string
  vendor: CpuVendor
  /**
   * Grafis terintegrasi milik prosesor ini, kalau ada.
   *
   * `null` berarti prosesornya TIDAK punya grafis sama sekali — dan itu bukan
   * detail sepele: paket tanpa VGA diskrit yang memakai prosesor berakhiran F
   * tidak akan menampilkan gambar, apalagi menjalankan game. Model perlu tahu.
   */
  integratedGpu: string | null
}

/**
 * Akhiran WAJIB menempel pada nomor serinya — tanpa spasi, dan hanya dari
 * daftar akhiran yang benar-benar dipakai pabrikan.
 *
 * Pola yang lebih longgar (`\s*([a-z]{0,3})`) sempat menghasilkan
 * `"Core i5-12400BOX"` untuk produk bernama "Core i5 12400 Box": kata "Box"
 * di nama retail terbaca sebagai varian chip. Akibatnya bukan sekadar nama
 * jelek — akhiran itu yang menentukan ada tidaknya grafis terintegrasi, jadi
 * satu kata kemasan bisa mengubah vonis "bisa dipakai tanpa VGA" atau tidak.
 */
const INTEL_SUFFIX = "(kf|ks|k|f|t|s|x)?"
const AMD_SUFFIX = "(x3d|xt|ge|gt|g|x|f)?"

const INTEL_ULTRA_PATTERN = new RegExp(
  `\\bcore\\s*ultra\\s*([3579])\\s*(\\d{3})${INTEL_SUFFIX}\\b`,
  "i"
)
const INTEL_CORE_PATTERN = new RegExp(
  `\\b(?:core\\s*)?i([3579])[\\s-]*(\\d{3,5})${INTEL_SUFFIX}\\b`,
  "i"
)
const AMD_RYZEN_PATTERN = new RegExp(
  `\\bryzen\\s*([3579])\\s*(\\d{4})${AMD_SUFFIX}\\b`,
  "i"
)

/**
 * Grafis terintegrasi Intel — ditentukan akhirannya, bukan serinya.
 *
 * Akhiran "F" berarti grafisnya dimatikan di pabrik. Satu huruf yang
 * membedakan "paket kantor tanpa VGA ini bisa dipakai" dari "paket ini tidak
 * akan menampilkan gambar sama sekali".
 */
function intelIntegratedGpu(suffix: string): string | null {
  return suffix.toLowerCase().includes("f") ? null : "Intel UHD Graphics"
}

/**
 * Grafis terintegrasi AMD — tiga kelas yang jauh berbeda, jangan disamakan.
 *
 * APU berakhiran G punya grafis yang benar-benar sanggup game ringan. Ryzen
 * seri 7000 ke atas punya grafis RDNA2 dua CU yang cuma cukup menampilkan
 * desktop. Ryzen 5000 tanpa G tidak punya grafis sama sekali.
 */
function amdIntegratedGpu(series: number, suffix: string): string | null {
  const akhiran = suffix.toLowerCase()

  if (akhiran === "f") return null

  if (akhiran.startsWith("g")) {
    return series >= 8 ? "Radeon 700M (APU)" : "Radeon Vega (APU)"
  }

  // Seri 7000 ke atas selalu membawa grafis dasar, walau cuma untuk desktop.
  if (series >= 7) return "Radeon Graphics (RDNA2 dasar, bukan untuk game)"

  return null
}

export function parseCpuSpec(name: string): CpuSpec | null {
  const ultra = name.match(INTEL_ULTRA_PATTERN)
  if (ultra) {
    const suffix = ultra[3] ? ultra[3].toUpperCase() : ""
    return {
      chip: `Core Ultra ${ultra[1]} ${ultra[2]}${suffix}`,
      vendor: "intel",
      integratedGpu: intelIntegratedGpu(suffix),
    }
  }

  const core = name.match(INTEL_CORE_PATTERN)
  if (core) {
    const suffix = core[3] ? core[3].toUpperCase() : ""
    return {
      chip: `Core i${core[1]}-${core[2]}${suffix}`,
      vendor: "intel",
      integratedGpu: intelIntegratedGpu(suffix),
    }
  }

  const ryzen = name.match(AMD_RYZEN_PATTERN)
  if (ryzen) {
    const suffix = ryzen[3] ? ryzen[3].toUpperCase() : ""
    const series = Number(ryzen[2].charAt(0))
    return {
      chip: `Ryzen ${ryzen[1]} ${ryzen[2]}${suffix}`,
      vendor: "amd",
      integratedGpu: amdIntegratedGpu(series, suffix),
    }
  }

  return null
}

/* ------------------------------------------------------------------------- *
 * RAM
 * ------------------------------------------------------------------------- */

export type RamSpec = {
  /** Total kapasitas dalam GB. */
  totalGb: number
  /**
   * Jumlah keping. 0 = tidak tertulis.
   *
   * Inilah yang menentukan dual channel, dan karena itu bidang paling berharga
   * di sini: 16GB satu keping bisa 10-20% lebih lambat daripada 16GB dua keping
   * pada VGA diskrit, dan jauh lebih parah pada grafis terintegrasi yang
   * memakai RAM sistem sebagai VRAM.
   */
  sticks: number
  /** "DDR3" | "DDR4" | "DDR5", atau kosong kalau tidak tertulis. */
  generation: string
  /** Kecepatan dalam MHz. 0 = tidak tertulis. */
  speedMhz: number
}

/**
 * Bentuk yang dipakai staff HNS untuk kit dua keping: `32GB (2x16GB)`.
 *
 * Ditangkap lebih dulu daripada pola kapasitas biasa, karena di teks yang sama
 * ada DUA angka GB dan yang benar sebagai total adalah yang di luar kurung.
 */
const RAM_KIT_PATTERN = /\b(\d)\s*[x×]\s*(\d{1,3})\s*gb\b/i
const RAM_CAPACITY_PATTERN = /\b(\d{1,3})\s*gb\b/gi
const RAM_GENERATION_PATTERN = /\bddr\s*-?\s*([345])\b/i
const RAM_SPEED_LABELED_PATTERN = /\b(\d{4,5})\s*(?:mhz|mt\/s)\b/i
const RAM_SPEED_AFTER_DDR_PATTERN = /\bddr\s*-?[345][\s-]+(\d{4,5})\b/i

/** Rentang kecepatan RAM yang masuk akal — di luar ini pasti angka lain. */
const MIN_RAM_SPEED = 1066
const MAX_RAM_SPEED = 9000

function readRamSpeed(name: string): number {
  const labeled = name.match(RAM_SPEED_LABELED_PATTERN)
  if (labeled) {
    const speed = Number(labeled[1])
    if (speed >= MIN_RAM_SPEED && speed <= MAX_RAM_SPEED) return speed
  }

  const afterDdr = name.match(RAM_SPEED_AFTER_DDR_PATTERN)
  if (afterDdr) {
    const speed = Number(afterDdr[1])
    if (speed >= MIN_RAM_SPEED && speed <= MAX_RAM_SPEED) return speed
  }

  return 0
}

export function parseRamSpec(name: string): RamSpec | null {
  const generationMatch = name.match(RAM_GENERATION_PATTERN)
  const generation = generationMatch ? `DDR${generationMatch[1]}` : ""
  const speedMhz = readRamSpeed(name)

  const kit = name.match(RAM_KIT_PATTERN)
  if (kit) {
    const sticks = Number(kit[1])
    const perStick = Number(kit[2])
    return { totalGb: sticks * perStick, sticks, generation, speedMhz }
  }

  // Tanpa notasi kit, yang TERBESAR dipakai sebagai total. Nama produk RAM
  // kadang memuat angka lain berakhiran GB (kapasitas maksimum yang didukung),
  // dan kapasitas modulnya sendiri hampir selalu yang terbesar disebut.
  let totalGb = 0
  for (const match of name.matchAll(RAM_CAPACITY_PATTERN)) {
    totalGb = Math.max(totalGb, Number(match[1]))
  }

  if (totalGb === 0 && !generation) return null

  return { totalGb, sticks: 0, generation, speedMhz }
}

/**
 * Beberapa baris RAM dalam satu paket → satu spesifikasi sistem.
 *
 * Kuantitas IKUT DIHITUNG, dan ini bukan detail administratif: dua keping
 * "8GB DDR4" adalah 16GB dual channel, bukan 8GB single channel. Paket seperti
 * itu lazim di HNS, dan tanpa penggabungan ini model menerima separuh dari RAM
 * yang sebenarnya terpasang — persis kekeliruan "RAM 8 GB single channel" yang
 * tercatat di kepala endpoint analisis.
 *
 * Kecepatan memakai yang TERENDAH: modul campuran berjalan di kecepatan modul
 * paling lambat, bukan rata-ratanya.
 */
export function combineRamSpecs(
  items: readonly { spec: RamSpec; quantity: number }[]
): RamSpec | null {
  if (items.length === 0) return null

  let totalGb = 0
  let sticks = 0
  let generation = ""
  let speedMhz = 0

  for (const { spec, quantity } of items) {
    const jumlah = quantity > 0 ? quantity : 1
    totalGb += spec.totalGb * jumlah
    // Baris tanpa notasi kit dianggap satu keping per unit yang dibeli.
    sticks += (spec.sticks > 0 ? spec.sticks : 1) * jumlah
    if (!generation && spec.generation) generation = spec.generation
    if (spec.speedMhz > 0) {
      speedMhz = speedMhz === 0 ? spec.speedMhz : Math.min(speedMhz, spec.speedMhz)
    }
  }

  return { totalGb, sticks, generation, speedMhz }
}

/* ------------------------------------------------------------------------- *
 * Bentuk terbaca untuk prompt
 * ------------------------------------------------------------------------- */

export function describeGpu(spec: GpuSpec): string {
  const vram = spec.vramGb > 0 ? `, VRAM ${spec.vramGb}GB` : ", VRAM tidak tertulis"
  return `${spec.chip}${vram}`
}

export function describeCpu(spec: CpuSpec): string {
  const igpu = spec.integratedGpu
    ? `, grafis terintegrasi: ${spec.integratedGpu}`
    : ", TANPA grafis terintegrasi"
  return `${spec.chip}${igpu}`
}

export function describeRam(spec: RamSpec): string {
  const bagian = [`${spec.totalGb}GB`]

  if (spec.generation) bagian.push(spec.generation)
  if (spec.speedMhz > 0) bagian.push(`${spec.speedMhz}MHz`)

  if (spec.sticks >= 2) bagian.push(`${spec.sticks} keping (dual channel)`)
  else if (spec.sticks === 1) bagian.push("1 keping (single channel)")

  return bagian.join(" ")
}
