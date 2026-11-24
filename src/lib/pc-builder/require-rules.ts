/**
 * Aturan WAJIB BERSYARAT antar-langkah PC Builder:
 *
 *   "Kalau pilihan di step INI punya / tidak punya atribut A = nilai X,
 *    maka step B wajib diisi."
 *
 * Murni — tanpa Prisma, tanpa next/cache — supaya wizard di klien dan form
 * admin bisa mengimpornya. `config.ts` memakai `parseRequireRules` saat
 * membaca & menyimpan konfigurasi.
 *
 * # Kasus yang melahirkannya
 *
 * Prosesor tanpa grafis terintegrasi (seri F Intel, Ryzen non-G) tidak bisa
 * menampilkan gambar tanpa VGA. Centang "Required" di step VGA terlalu kasar:
 * ia juga memaksa pembeli Ryzen 8600G membeli VGA yang tidak mereka butuhkan.
 * Aturannya cukup: step Processor → `tidak punya` IGPU = "IGPU" → wajib VGA.
 *
 * # Atribut yang BELUM DIISI tidak memicu apa pun — termasuk "tidak punya"
 *
 * Produk yang sama sekali tidak punya baris untuk atribut A dianggap BELUM
 * DIISI, bukan "tidak punya nilai X". Aturan tidak menyala untuknya, dengan
 * operator apa pun.
 *
 * Ini keputusan pemilik bisnis (20 November 2026), bukan kelalaian: data yang
 * lupa diisi staff tidak boleh berakhir memaksa pelanggan membeli komponen.
 * Konsekuensinya, prosesor tanpa iGPU WAJIB diberi nilai lain untuk atribut
 * itu (mis. IGPU = "Tidak ada") supaya aturannya menyala — persis seperti
 * prosesor harus diberi socket LGA1700 supaya penyaringan motherboard jalan.
 *
 * Perilakunya sengaja sama dengan aturan kompatibilitas di `compatibility.ts`:
 * induk tanpa nilai untuk sebuah atribut tidak memberi syarat apa pun. Jangan
 * "memperbaiki" ini menjadi "tidak ada baris = tidak punya" tanpa persetujuan
 * — itu membalik arah gagalnya.
 *
 * # Satu fungsi untuk semua pembaca
 *
 * Tanda `*` di Build Progress, pengingat saat pindah langkah, dan penjaga
 * Print/WA semuanya membaca `resolveStepRequirements`. Kalau salah satunya
 * membaca `isRequired` langsung, tanda bintangnya bilang wajib sementara
 * tombol Print meloloskan — atau sebaliknya.
 */

export const REQUIRE_RULE_MATCHES = ["has", "lacks"] as const
export type RequireRuleMatch = (typeof REQUIRE_RULE_MATCHES)[number]

export function isRequireRuleMatch(value: unknown): value is RequireRuleMatch {
  return typeof value === "string" && (REQUIRE_RULE_MATCHES as readonly string[]).includes(value)
}

export type PcBuilderRequireRule = {
  /** Kunci baris di form admin. Tidak bermakna di luar itu. */
  id: string
  attributeId: number
  /** Cukup SALAH SATU nilai ini (OR) — sama dengan aturan kompatibilitas. */
  valueIds: number[]
  match: RequireRuleMatch
  /** Step yang menjadi wajib saat aturan menyala. */
  targetStepId: string
  /**
   * Alasan yang dibaca pelanggan, ditulis staff — mis. "Processor yang dipilih
   * tidak memiliki Grafis Internal". Kosong = kalimat otomatis dari nama
   * atribut & nilainya (`describeRequirement`). Nama atribut di katalog sering
   * singkatan teknis ("IGPU"), jadi kalimat otomatis cukup sebagai cadangan,
   * bukan sebagai bahasa untuk pelanggan.
   */
  message?: string
}

/** Batas panjang `message` — satu kalimat di toast, bukan paragraf. */
export const MAX_RULE_MESSAGE_LENGTH = 160

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

/**
 * Isi mentah `requireRules` → daftar aturan yang sah.
 *
 * Kolomnya JSON bebas. Aturan yang cacat DIBUANG, bukan diteruskan: aturan
 * tanpa nilai atau tanpa step tujuan tidak bisa berarti apa pun, dan menebak
 * maksudnya lebih berbahaya daripada mengabaikannya.
 *
 * `stepIds` (opsional) membuang aturan yang menunjuk step yang sudah tidak ada
 * atau menunjuk step pemiliknya sendiri.
 */
export function parseRequireRules(
  value: unknown,
  ownerStepId?: string,
  stepIds?: ReadonlySet<string>
): PcBuilderRequireRule[] {
  if (!Array.isArray(value)) return []

  const rules: PcBuilderRequireRule[] = []
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue
    const r = raw as Record<string, unknown>

    if (typeof r.id !== "string" || r.id === "") continue
    if (!isPositiveInt(r.attributeId)) continue
    if (!isRequireRuleMatch(r.match)) continue
    if (typeof r.targetStepId !== "string" || r.targetStepId === "") continue
    if (ownerStepId !== undefined && r.targetStepId === ownerStepId) continue
    if (stepIds && !stepIds.has(r.targetStepId)) continue
    if (!Array.isArray(r.valueIds)) continue

    const valueIds = [...new Set(r.valueIds.filter(isPositiveInt))]
    if (valueIds.length === 0) continue

    const rule: PcBuilderRequireRule = {
      id: r.id,
      attributeId: r.attributeId,
      valueIds,
      match: r.match,
      targetStepId: r.targetStepId,
    }
    // Pesan yang bukan string, kosong, atau kepanjangan tidak membuang
    // aturannya — aturan tetap bekerja dengan kalimat otomatis.
    if (typeof r.message === "string") {
      const message = r.message.trim()
      if (message !== "" && message.length <= MAX_RULE_MESSAGE_LENGTH) rule.message = message
    }
    rules.push(rule)
  }
  return rules
}

/* ------------------------------------------------------------------------- *
 * Evaluasi
 * ------------------------------------------------------------------------- */

/** Bentuk minimum produk terpilih yang dibutuhkan evaluasi — `BuilderProduct` memenuhinya. */
type RuleProduct = {
  attributes: { attributeId: number; attributeName: string; valueId: number; valueName: string }[]
}

type RuleStep = {
  id: string
  name: string
  isRequired?: boolean
  requireRules?: PcBuilderRequireRule[]
}

/** Kenapa sebuah step menjadi wajib — untuk diterangkan ke pelanggan. */
export type ConditionalRequirement = {
  triggerStepId: string
  triggerStepName: string
  attributeName: string
  /** Nilai yang BENAR-BENAR tercatat di produk pemicu, bukan nilai di aturan. */
  valueNames: string[]
  /** Pesan tulisan staff dari aturannya, kalau ada. */
  message?: string
}

/**
 * Nilai atribut sebuah produk yang memicu aturan, atau `null` kalau tidak.
 *
 * Mengembalikan nilai milik PRODUK (bukan nilai di aturan) supaya keterangannya
 * selalu kalimat yang benar: untuk operator "tidak punya", nilai di aturan
 * justru yang TIDAK dimiliki produk.
 */
function triggeringValues(rule: PcBuilderRequireRule, product: RuleProduct) {
  const own = product.attributes.filter((a) => a.attributeId === rule.attributeId)
  // Belum diisi → tidak menyala, dengan operator apa pun. Lihat catatan berkas.
  if (own.length === 0) return null

  const hit = own.some((a) => rule.valueIds.includes(a.valueId))
  const fires = rule.match === "has" ? hit : !hit
  return fires ? own : null
}

/**
 * Step mana saja yang wajib untuk rakitan ini, dan alasannya.
 *
 * Kunci yang ADA di peta = step wajib. Nilainya kosong untuk step yang memang
 * dicentang "Required"; berisi alasan untuk yang wajib karena aturan bersyarat.
 * Step pemicu yang boleh banyak pilihan cukup satu produknya cocok.
 */
export function resolveStepRequirements(
  steps: RuleStep[],
  selections: Record<string, Array<{ product: RuleProduct }> | undefined>
): Map<string, ConditionalRequirement[]> {
  const result = new Map<string, ConditionalRequirement[]>()
  const stepIds = new Set(steps.map((s) => s.id))

  for (const step of steps) {
    if (step.isRequired) result.set(step.id, result.get(step.id) ?? [])
  }

  for (const step of steps) {
    const rules = step.requireRules
    if (!rules || rules.length === 0) continue

    const picked = selections[step.id]
    if (!Array.isArray(picked) || picked.length === 0) continue

    for (const rule of rules) {
      if (rule.targetStepId === step.id || !stepIds.has(rule.targetStepId)) continue

      for (const { product } of picked) {
        const values = triggeringValues(rule, product)
        if (!values) continue

        const reasons = result.get(rule.targetStepId) ?? []
        reasons.push({
          triggerStepId: step.id,
          triggerStepName: step.name,
          attributeName: values[0].attributeName,
          valueNames: [...new Set(values.map((v) => v.valueName))],
          message: rule.message,
        })
        result.set(rule.targetStepId, reasons)
        break // satu produk cocok sudah cukup untuk aturan ini
      }
    }
  }

  return result
}

/**
 * Alasan untuk pelanggan, TANPA titik akhir — pemanggil yang menyusunnya ke
 * dalam kalimat ("Wajib diisi karena …."). Pesan tulisan staff didahulukan;
 * tanpanya: "Processor yang dipilih memiliki IGPU: Tidak ada".
 */
export function describeRequirement(reason: ConditionalRequirement): string {
  if (reason.message) return reason.message.replace(/[.\s]+$/, "")
  return `${reason.triggerStepName} yang dipilih memiliki ${reason.attributeName}: ${reason.valueNames.join(", ")}`
}

/** Atribut yang dibaca aturan — wajib ikut termuat di produk grid wizard. */
export function requireRuleAttributeIds(steps: RuleStep[]): number[] {
  const ids = new Set<number>()
  for (const step of steps) {
    for (const rule of step.requireRules ?? []) ids.add(rule.attributeId)
  }
  return [...ids]
}
