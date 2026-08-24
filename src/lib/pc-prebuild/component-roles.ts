/**
 * Menebak PERAN sebuah komponen (prosesor, RAM, VGA, …) dari teks yang ada di
 * sekelilingnya: nama langkah PC Builder, nama kategori katalog, dan nama
 * produknya.
 *
 * Kenapa menebak, bukan membaca field? Langkah PC Builder dibuat staff di
 * `/admin/pc-builder` dan namanya bebas — tidak ada kolom "peran komponen" di
 * mana pun, dan menambahkannya berarti mengubah fitur lain sekaligus meminta
 * staff mengisi ulang seluruh langkah yang sudah jalan.
 *
 * Berkas ini TIDAK mengimpor apa pun (lihat `limits.ts`): panel admin memakainya
 * untuk memutuskan tombol "Hitung Performa" boleh aktif atau belum, dan endpoint
 * AI memakainya untuk menolak permintaan yang komponennya belum cukup. Satu
 * aturan, dua pemakai — kalau keduanya punya daftar kata kunci sendiri, tombol
 * yang menyala akan menghasilkan penolakan dari server.
 */

export const PREBUILD_COMPONENT_ROLES = [
  "cpu",
  "motherboard",
  "ram",
  "storage",
  "gpu",
  "psu",
  "cooler",
  "case",
  "monitor",
  "peripheral",
  "other",
] as const

export type PrebuildComponentRole = (typeof PREBUILD_COMPONENT_ROLES)[number]

/** Label Indonesia untuk pesan di layar admin. */
export const COMPONENT_ROLE_LABELS: Record<PrebuildComponentRole, string> = {
  cpu: "Processor",
  motherboard: "Motherboard",
  ram: "RAM",
  storage: "Penyimpanan",
  gpu: "Graphics Card",
  psu: "Power Supply",
  cooler: "Pendingin",
  case: "Casing",
  monitor: "Monitor",
  peripheral: "Periferal",
  other: "Komponen lain",
}

/**
 * Peran yang WAJIB ada sebelum analisis boleh dijalankan.
 *
 * Sengaja tidak memuat GPU, motherboard, dan PSU. Paket kantor yang mengandalkan
 * grafis terintegrasi adalah kasus nyata di HNS, dan menuntut VGA diskrit akan
 * mengunci tombolnya untuk paket yang justru paling butuh penjelasan "ini cukup
 * untuk apa". Tanpa prosesor, RAM, atau penyimpanan, yang tersisa bukan PC.
 */
export const REQUIRED_ANALYSIS_ROLES: PrebuildComponentRole[] = ["cpu", "ram", "storage"]

/**
 * Urutan pemeriksaan PENTING — pola yang lebih spesifik didahulukan.
 *
 * "Motherboard" harus diuji sebelum pola prosesor, karena nama motherboard
 * lazim memuat soket prosesornya ("B760M untuk Intel Core 12/13"). Begitu pula
 * pendingin sebelum prosesor: "CPU Cooler" memuat kata "CPU" tapi ia bukan
 * prosesor.
 */
const ROLE_PATTERNS: Array<[PrebuildComponentRole, RegExp]> = [
  [
    "cooler",
    /\b(cooler|pendingin|heatsink|hsf|aio|liquid cool|water cool|casing fan|case fan|fan)\b/i,
  ],
  ["motherboard", /\b(mother\s?board|mobo|mainboard)\b/i],
  ["ram", /\b(ram|memori|memory|ddr[345]?|sodimm|dimm)\b/i],
  ["storage", /\b(ssd|hdd|nvme|m\.?2|sata|hard\s?disk|hardisk|storage|penyimpanan)\b/i],
  ["gpu", /\b(vga|gpu|graphic|grafis|geforce|radeon|rtx|gtx|rx\s?\d{3,4}|arc\s?a\d{3})\b/i],
  ["psu", /\b(psu|power\s?supply|daya|watt|80\+)\b/i],
  ["cpu", /\b(processor|prosesor|cpu|ryzen|core\s?i[3579]|athlon|pentium|celeron|apu)\b/i],
  ["case", /\b(casing|case|chassis|tower)\b/i],
  ["monitor", /\b(monitor|layar|display|led\s?\d{2})\b/i],
  ["peripheral", /\b(keyboard|mouse|tetikus|headset|headphone|speaker|webcam|mousepad)\b/i],
]

/**
 * Peran komponen dari satu atau beberapa petunjuk teks.
 *
 * Petunjuk diuji BERURUTAN, dan yang pertama cocok menang. Panggil dengan
 * petunjuk paling tepercaya lebih dulu — biasanya nama langkah, lalu nama
 * kategori, baru nama produk. Nama produk paling akhir karena ia paling sering
 * memuat kata milik komponen lain ("RAM 16GB untuk Motherboard B760").
 */
export function detectComponentRole(
  ...hints: (string | null | undefined)[]
): PrebuildComponentRole {
  for (const hint of hints) {
    if (!hint) continue
    for (const [role, pattern] of ROLE_PATTERNS) {
      if (pattern.test(hint)) return role
    }
  }

  return "other"
}

/** Peran wajib yang belum terisi. Kosong = analisis boleh dijalankan. */
export function missingRequiredRoles(
  roles: Iterable<PrebuildComponentRole>
): PrebuildComponentRole[] {
  const ada = new Set(roles)
  return REQUIRED_ANALYSIS_ROLES.filter((role) => !ada.has(role))
}
