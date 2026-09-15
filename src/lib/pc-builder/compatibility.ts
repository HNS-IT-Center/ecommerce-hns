/**
 * SATU aturan kompatibilitas antar-langkah PC Builder.
 *
 * Aturan ini dipakai di tiga tempat yang WAJIB sepakat, kalau tidak pelanggan
 * melihat kartu yang lolos grid lalu dibuang begitu diklik:
 *
 * 1. Grid wizard (`fetchBuilderProducts`) — menyaring kandidat di database.
 * 2. Store wizard (`selectProduct`) — memangkas pilihan langkah lain yang jadi
 *    tidak cocok setelah sebuah komponen dipilih.
 * 3. Pemilih komponen paket prebuild di panel admin
 *    (`searchPrebuildProducts`).
 *
 * # IRISAN, bukan himpunan bagian
 *
 * Satu atribut bisa punya BANYAK nilai pada satu produk. Casing ATX tercatat
 * sebagai tiga baris "Motherboard Size" sekaligus — Mini-ITX, Micro-ATX, dan
 * ATX — karena ketiganya memang muat di dalamnya. Motherboard-nya sendiri hanya
 * punya satu: Micro-ATX.
 *
 * Aturan lama membandingkan NILAI PERTAMA saja (`.find()` + `!==`), dan itu
 * salah begitu induknya bernilai jamak: nilai mana yang terambil bergantung
 * urutan baris atribut di database, jadi casing ATX yang justru dirancang
 * memuat motherboard Micro-ATX bisa dinyatakan tidak cocok. Akibatnya di
 * lapangan: pelanggan memilih casing, dan motherboard yang sudah dipilih
 * terbuang diam-diam tanpa satu pun pesan.
 *
 * Aturan yang benar adalah IRISAN — cukup ada SATU nilai yang sama per atribut:
 *
 *   - Motherboard {Micro-ATX} × Casing {Mini-ITX, Micro-ATX, ATX} → cocok.
 *   - Motherboard {ATX}       × Casing {Mini-ITX}                 → tidak cocok.
 *   - CPU {AM4}               × Motherboard {AM4}                 → cocok.
 *
 * Irisan juga SIMETRIS, dan itu bukan kebetulan melainkan syarat: hasilnya
 * tidak boleh bergantung pada komponen mana yang kebetulan dipilih lebih dulu.
 * Aturan lama tidak simetris, sehingga "casing dulu baru motherboard" dan
 * "motherboard dulu baru casing" memberi jawaban berbeda untuk rakitan yang
 * sama persis.
 *
 * Induk yang tidak punya nilai sama sekali untuk sebuah atribut TIDAK memberi
 * syarat apa pun — sama seperti dulu, dan sama seperti yang dilakukan grid yang
 * tidak mengirimkan kelompok untuknya.
 */

/** Bentuk minimum satu atribut produk yang dibutuhkan pemeriksaan ini. */
export type CompatibilityAttribute = { attributeId: number; valueId: number }

/**
 * Satu kelompok = seluruh nilai SATU atribut milik SATU komponen induk.
 *
 * Kandidat harus memenuhi SEMUA kelompok (AND antar kelompok), tapi di dalam
 * satu kelompok cukup salah satu nilainya (OR di dalam kelompok). Pengelompokan
 * per komponen induk inilah yang menjaga dua induk berbeda tidak saling
 * melonggarkan syarat: kalau prosesor mensyaratkan DDR5 dan motherboard
 * menerima DDR4 atau DDR5, RAM DDR4 tetap harus gugur karena kelompok milik
 * prosesor tidak terpenuhi.
 */
export type AttributeRequirementGroup = number[]

/**
 * Susun kelompok syarat dari komponen-komponen yang sudah dipilih di langkah
 * yang diandalkan (`dependSteps`), disaring ke atribut yang memang diperiksa
 * langkah ini (`dependAttributes`).
 */
export function buildAttributeRequirementGroups(
  parents: Array<{ attributes: CompatibilityAttribute[] }>,
  dependAttributes: number[] | undefined
): AttributeRequirementGroup[] {
  if (!dependAttributes || dependAttributes.length === 0) return []

  const groups: AttributeRequirementGroup[] = []

  for (const parent of parents) {
    const byAttribute = new Map<number, Set<number>>()

    for (const attr of parent.attributes) {
      if (!dependAttributes.includes(attr.attributeId)) continue
      const values = byAttribute.get(attr.attributeId) ?? new Set<number>()
      values.add(attr.valueId)
      byAttribute.set(attr.attributeId, values)
    }

    for (const values of byAttribute.values()) {
      groups.push([...values])
    }
  }

  return groups
}

/**
 * Apakah `dependent` cocok dengan `parent` menurut `dependAttributes`.
 *
 * Dinyatakan lewat `buildAttributeRequirementGroups` supaya pemeriksaan di
 * klien dan penyaringan di database mustahil berbeda aturan — keduanya membaca
 * kelompok yang disusun fungsi yang sama.
 */
export function isAttributeCompatible(
  dependent: { attributes: CompatibilityAttribute[] },
  parent: { attributes: CompatibilityAttribute[] },
  dependAttributes: number[] | undefined
): boolean {
  const groups = buildAttributeRequirementGroups([parent], dependAttributes)
  if (groups.length === 0) return true

  const dependentValueIds = new Set(dependent.attributes.map((a) => a.valueId))
  return groups.every((group) => group.some((valueId) => dependentValueIds.has(valueId)))
}
