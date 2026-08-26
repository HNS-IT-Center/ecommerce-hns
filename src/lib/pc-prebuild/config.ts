/**
 * Lapisan data untuk paket "PC Prebuild" — rakitan siap pakai yang disusun
 * staff, lalu dimuat ke wizard `/build-pc` dan boleh diubah pelanggan.
 *
 * Mengikuti konvensi `lib/pc-builder/config.ts`: pembacaan lewat
 * `unstable_cache` bertag, dan `revalidateTag` TIDAK dipanggil dari sini
 * melainkan dari lapisan action — supaya berkas ini tetap bisa dipakai dari
 * skrip tanpa menyeret konteks request.
 *
 * **Preset TIDAK menyimpan harga.** Isinya hanya `productId`, `variationId`,
 * dan `quantity`; harga selalu dibaca ulang dari katalog saat halaman dirender.
 * Ini keharusan CLAUDE.md §2.7, bukan pilihan gaya: preset yang menyimpan angka
 * akan menampilkan harga yang benar hari ini dan salah bulan depan tanpa ada
 * yang menyadarinya. Persis itu yang pernah terjadi pada panel "My Build" yang
 * membaca harga dari localStorage (diperbaiki di commit 9f45230).
 *
 * **Langkahnya menumpang `PC_BUILDER_CONFIG`.** Tidak ada daftar langkah kedua
 * yang perlu dijaga — `stepId` di sini menunjuk step yang sama dengan yang
 * dipakai wizard.
 *
 * ## Tiga bentuk masuk, satu bentuk keluar
 *
 * Parser menerima ketiganya dan selalu mengeluarkan yang terbaru.
 * `savePcPrebuildConfig` menjalankan parser ini sebelum menulis, jadi setiap
 * penyimpanan menormalkan datanya. Kalau tidak begitu, tiga bentuk akan hidup
 * berdampingan di kolom `settings` selamanya dan setiap pembaca berikutnya
 * harus tahu ketiganya.
 *
 * | Generasi | Bentuk | Dibaca jadi |
 * |---|---|---|
 * | 1 | `items: [{ stepId, productId, quantity }]` (di level preset) | satu slot berisi satu barang |
 * | 2 | `slots: [{ stepId, options: [...] }]` | `options[0]` jadi barang, sisanya jadi `alternatives`-nya |
 * | 3 | `slots: [{ stepId, items: [{ productId, variationId?, quantity, alternatives }] }]` | apa adanya |
 *
 * Generasi 3 memisahkan dua hal yang generasi 2 campur jadi satu:
 *
 * - **`items`** — barang yang terpasang BERSAMAAN. Dua NVMe berbeda di satu
 *   rakitan adalah dua item, dan dua-duanya masuk ke keranjang.
 * - **`alternatives`** — pilihan TUKAR untuk satu barang. Pelanggan memilih
 *   salah satu; yang pertama (yaitu item-nya sendiri) adalah bawaan.
 *
 * Generasi 2 hanya punya `options`, yang artinya "pilihan tukar" — jadi
 * migrasinya lurus: pilihan pertama jadi barangnya, sisanya jadi pilihan
 * tukarnya. Tidak ada data yang hilang.
 */
import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import { DEFAULT_PREBUILD_GAMES, parsePrebuildGames, type PrebuildGame } from "./games"
import {
  MAX_ALTERNATIVES_PER_ITEM,
  MAX_BRANCHING_ITEMS,
  MAX_ITEMS_PER_SLOT,
  MAX_PREBUILD_IMAGES,
  MAX_QUANTITY_PER_ITEM,
} from "./limits"
import { parsePrebuildPerformance, type PrebuildPerformance } from "./performance"

export const PC_PREBUILD_CACHE_TAG = "pc-prebuild-config"
export const PC_PREBUILD_SETTING_KEY = "PC_PREBUILD_CONFIG"

/**
 * Daftar game disimpan di baris `settings` TERPISAH dari konfigurasi paket.
 *
 * Dua alasan: ia satu daftar untuk semua paket (bukan milik salah satu), dan
 * menyimpannya bersama paket berarti setiap penyuntingan daftar game menulis
 * ulang — dan berisiko menimpa — seluruh konfigurasi paket. Pola yang sama
 * dipakai `PC_BUILDER_DISPLAY` terhadap `PC_BUILDER_CONFIG`.
 */
export const PC_PREBUILD_GAMES_CACHE_TAG = "pc-prebuild-games"
export const PC_PREBUILD_GAMES_SETTING_KEY = "PC_PREBUILD_GAMES"

// Batasnya tinggal di berkas sendiri supaya panel admin (Client Component)
// bisa memakainya tanpa menyeret Prisma ke bundle browser. Lihat limits.ts.
export {
  MAX_ALTERNATIVES_PER_ITEM,
  MAX_BRANCHING_ITEMS,
  MAX_ITEMS_PER_SLOT,
  MAX_PREBUILD_IMAGES,
  MAX_QUANTITY_PER_ITEM,
} from "./limits"

/**
 * Pilihan tukar untuk satu barang — pelanggan memilih salah satu.
 *
 * `productId` mengidentifikasi pilihan, TERMASUK di URL `?pick=`. Karena itu ia
 * tidak boleh kembar dalam satu barang: dua tombol yang menunjuk produk sama
 * tidak bisa dibedakan satu sama lain.
 */
export type PcPrebuildAlternative = {
  productId: number
  /**
   * Varian yang dipilih, kalau produknya bertipe VARIABLE.
   *
   * Menunjuk baris `Product` bertipe VARIATION yang `parentId`-nya adalah
   * `productId` di atas. Kosong = produknya SIMPLE, atau induknya dipakai apa
   * adanya.
   */
  variationId?: number
  quantity: number
  /**
   * Label pendek untuk tombol pilihannya — "16 GB", "Hitam", "Samsung".
   * Kosong = pakai nama produknya.
   *
   * Nama produk terlalu panjang untuk jadi tombol: "SSD SAMSUNG 980 NVME M.2
   * 1TB" tidak terbaca sebagai pilihan, "Samsung 1TB" terbaca.
   */
  label?: string
}

/**
 * Satu barang di dalam sebuah langkah. Semua item dalam satu slot terpasang
 * BERSAMAAN — bukan saling menggantikan.
 */
export type PcPrebuildItem = PcPrebuildAlternative & {
  /**
   * Pilihan tukar untuk barang INI. Kosong = komponen tetap.
   *
   * Barang ini sendiri adalah bawaannya; `alternatives` berisi penggantinya.
   * Fitur pemilihan di sisi pelanggan belum dirancang ulang — bidang ini sudah
   * ada supaya bentuk datanya tidak perlu dibongkar lagi saat nanti dinyalakan.
   */
  alternatives: PcPrebuildAlternative[]
}

export type PcPrebuildSlot = {
  stepId: string
  /**
   * TIDAK PERNAH kosong: slot tanpa barang tidak punya arti, jadi dilewati saat
   * dibaca dan ditolak saat disimpan.
   *
   * Pasangan (`productId`, `variationId`) tidak boleh kembar dalam satu slot —
   * dua baris yang menunjuk barang yang sama persis bukan dua barang, itu satu
   * barang dengan jumlah dua, dan `quantity` sudah menanganinya.
   */
  items: PcPrebuildItem[]
}

export type PcPrebuildPreset = {
  id: string
  name: string
  summary: string
  /**
   * Foto rakitan jadi — hasil unggah ke Cloudflare R2 lewat
   * POST /api/admin/media, satu-satunya jalur unggah foto di project ini
   * (CLAUDE.md §2.2). Yang disimpan URL-nya saja.
   *
   * Yang PERTAMA adalah foto utama. Boleh kosong: foto komponen satu per satu
   * sudah ada di katalog; ini foto PC-nya UTUH, yang paling menentukan kesan
   * pelanggan dan tidak bisa disusun dari foto komponen.
   */
  images: string[]
  order: number
  slots: PcPrebuildSlot[]
  /**
   * Hasil analisis performa dari Groq — DRAF sampai staff menayangkannya.
   *
   * Opsional, dan tetap opsional selamanya: paket yang belum pernah dianalisis
   * harus tampil utuh tanpa panel performa, bukan tampil separuh. Bentuk dan
   * aturannya ada di `performance.ts`; di sini ia hanya menumpang tersimpan
   * bersama presetnya, karena ia memang cuma berlaku untuk satu paket itu.
   */
  performance?: PrebuildPerformance
}

export type PcPrebuildConfig = {
  /**
   * Sakelar tampil/tidaknya fitur ini ke pelanggan. Mematikan BUKAN menghapus:
   * presetnya tetap tersimpan, hanya rute publiknya yang ditutup.
   */
  enabled: boolean
  presets: PcPrebuildPreset[]
}

export const EMPTY_PREBUILD_CONFIG: PcPrebuildConfig = { enabled: false, presets: [] }

function angkaSah(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/** Kunci identitas satu barang. Varian ikut, karena 1 TB dan 2 TB bukan barang yang sama. */
function kunciBarang(item: { productId: number; variationId?: number }): string {
  return `${item.productId}~${item.variationId ?? 0}`
}

/**
 * Satu baris dianggap sah hanya kalau produk dan jumlahnya bertipe benar.
 *
 * Kolom `value` di tabel `settings` bertipe JSON bebas, jadi tidak ada yang
 * menjamin bentuknya selain pemeriksaan ini. Baris cacat DIBUANG, bukan
 * diteruskan: halaman yang memakainya memetakan `productId` ke katalog, dan
 * satu entri yang bukan angka cukup untuk menggagalkan seluruh halaman.
 */
function toAlternative(value: unknown): PcPrebuildAlternative | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>
  // `> 0` penting: panel admin membuat baris kosong dengan productId 0 sebagai
  // penampung sementara. Baris yang tidak pernah diisi harus mati di sini,
  // bukan tersimpan sebagai komponen yang tidak menunjuk produk apa pun.
  if (!angkaSah(raw.productId) || raw.productId <= 0) return null
  if (!angkaSah(raw.quantity) || raw.quantity <= 0) return null

  const label = typeof raw.label === "string" ? raw.label.trim() : ""
  const variationId = angkaSah(raw.variationId) && raw.variationId > 0 ? raw.variationId : 0

  return {
    productId: Math.round(raw.productId),
    ...(variationId ? { variationId: Math.round(variationId) } : {}),
    // Jumlah dijepit, bukan ditolak: paket yang terlanjur menyimpan angka
    // kelewat besar tetap terpakai, cuma jumlahnya dibetulkan.
    quantity: Math.min(MAX_QUANTITY_PER_ITEM, Math.round(raw.quantity)),
    ...(label ? { label } : {}),
  }
}

/** Buang pilihan tukar yang kembar (termasuk yang sama dengan barangnya sendiri), lalu potong. */
function rapikanAlternatives(raw: unknown[], barang: PcPrebuildAlternative): PcPrebuildAlternative[] {
  const hasil: PcPrebuildAlternative[] = []
  const sudahAda = new Set<string>([kunciBarang(barang)])

  for (const kandidat of raw) {
    const alt = toAlternative(kandidat)
    if (!alt) continue
    const kunci = kunciBarang(alt)
    if (sudahAda.has(kunci)) continue
    sudahAda.add(kunci)
    hasil.push(alt)
    if (hasil.length >= MAX_ALTERNATIVES_PER_ITEM) break
  }

  return hasil
}

function toItem(value: unknown): PcPrebuildItem | null {
  const dasar = toAlternative(value)
  if (!dasar) return null

  const raw = value as Record<string, unknown>
  const altRaw = Array.isArray(raw.alternatives) ? raw.alternatives : []

  return { ...dasar, alternatives: rapikanAlternatives(altRaw, dasar) }
}

/** Buang barang kembar dalam satu slot, lalu potong ke batas. */
function rapikanItems(raw: PcPrebuildItem[]): PcPrebuildItem[] {
  const hasil: PcPrebuildItem[] = []
  const sudahAda = new Set<string>()

  for (const item of raw) {
    const kunci = kunciBarang(item)
    if (sudahAda.has(kunci)) continue
    sudahAda.add(kunci)
    hasil.push(item)
    if (hasil.length >= MAX_ITEMS_PER_SLOT) break
  }

  return hasil
}

/**
 * Generasi 3 — bentuk yang berlaku sekarang.
 *
 * Juga menerima generasi 2 (`options`) di slot yang sama, karena satu kolom
 * JSON bisa saja memuat campuran kalau penyimpanan sebelumnya gagal separuh.
 */
function toSlot(value: unknown): PcPrebuildSlot | null {
  if (typeof value !== "object" || value === null) return null
  const slot = value as Record<string, unknown>
  if (typeof slot.stepId !== "string" || !slot.stepId) return null

  let items: PcPrebuildItem[] = []

  if (Array.isArray(slot.items)) {
    items = slot.items.map(toItem).filter((i): i is PcPrebuildItem => i !== null)
  } else if (Array.isArray(slot.options)) {
    // GENERASI 2 → 3. `options` berarti "pilihan tukar", jadi yang pertama
    // adalah barangnya dan sisanya jadi pilihan tukar milik barang itu.
    // Membacanya sebagai beberapa barang terpasang akan MENGGANDAKAN komponen
    // — paket RAM 16/32 GB tiba-tiba berisi dua keping sekaligus, dan totalnya
    // naik tanpa ada yang mengubah apa pun.
    const semua = slot.options
      .map(toAlternative)
      .filter((o): o is PcPrebuildAlternative => o !== null)
    if (semua.length > 0) {
      items = [{ ...semua[0], alternatives: rapikanAlternatives(semua.slice(1), semua[0]) }]
    }
  }

  const rapi = rapikanItems(items)
  if (rapi.length === 0) return null

  return { stepId: slot.stepId, items: rapi }
}

/**
 * GENERASI 1: satu produk per langkah, tanpa percabangan dan tanpa varian.
 *
 * Dibaca jadi slot berisi tepat satu barang. Tidak ada data yang hilang, dan
 * penyimpanan berikutnya dari panel admin menuliskannya dalam bentuk baru.
 */
function itemLamaToSlot(value: unknown): PcPrebuildSlot | null {
  if (typeof value !== "object" || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.stepId !== "string" || !raw.stepId) return null

  const dasar = toAlternative(raw)
  if (!dasar) return null

  return { stepId: raw.stepId, items: [{ ...dasar, alternatives: [] }] }
}

/** Gabungkan slot ber-stepId sama, lalu tegakkan batas barang bercabang. */
function rapikanSlots(slots: PcPrebuildSlot[]): PcPrebuildSlot[] {
  const perStep = new Map<string, PcPrebuildSlot>()

  for (const slot of slots) {
    const ada = perStep.get(slot.stepId)
    if (!ada) {
      perStep.set(slot.stepId, slot)
      continue
    }
    // Satu langkah hanya boleh punya satu slot. Barang dari entri kembar
    // digabung, bukan dibuang — bentuk lama bisa memuat langkah yang sama dua
    // kali, dan membuangnya diam-diam akan menghilangkan komponen.
    ada.items = rapikanItems([...ada.items, ...slot.items])
  }

  // Kalau barang bercabangnya lebih dari batas, yang berlebih DIKUNCI ke
  // bawaannya — bukan dibuang. Paketnya tetap utuh, cuma berhenti bercabang.
  let bercabang = 0
  return [...perStep.values()].map((slot) => ({
    ...slot,
    items: slot.items.map((item) => {
      if (item.alternatives.length === 0) return item
      bercabang += 1
      return bercabang <= MAX_BRANCHING_ITEMS ? item : { ...item, alternatives: [] }
    }),
  }))
}

function toPreset(value: unknown, index: number): PcPrebuildPreset | null {
  if (typeof value !== "object" || value === null) return null
  const preset = value as Record<string, unknown>
  if (typeof preset.id !== "string" || typeof preset.name !== "string") return null

  const dariSlots = Array.isArray(preset.slots)
    ? preset.slots.map(toSlot).filter((s): s is PcPrebuildSlot => s !== null)
    : []

  const dariItems = Array.isArray(preset.items)
    ? preset.items.map(itemLamaToSlot).filter((s): s is PcPrebuildSlot => s !== null)
    : []

  // `slots` menang kalau ada. `items` di level PRESET hanya dipakai untuk data
  // generasi 1 — jangan tertukar dengan `items` di dalam slot, yang generasi 3.
  const slots = rapikanSlots(dariSlots.length > 0 ? dariSlots : dariItems)

  // Dua bentuk masuk, satu bentuk keluar — pola yang sama dengan slots.
  // Bentuk lama menyimpan SATU foto di `image`; bentuk baru menyimpan daftar di
  // `images`. Paket yang sudah terlanjur berfoto tunggal tidak perlu diisi ulang.
  const dariBaru = Array.isArray(preset.images) ? preset.images : []
  const dariLama = typeof preset.image === "string" ? [preset.image] : []
  const images = [...new Set([...dariBaru, ...dariLama])]
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    .map((url) => url.trim())
    .slice(0, MAX_PREBUILD_IMAGES)

  // Analisis yang cacat DIBUANG, bukan diteruskan setengah jadi: panel performa
  // adalah tempelan di atas paket, jadi paketnya harus tetap utuh tanpanya.
  const performance = parsePrebuildPerformance(preset.performance)

  return {
    id: preset.id,
    name: preset.name,
    summary: typeof preset.summary === "string" ? preset.summary : "",
    images,
    order: angkaSah(preset.order) ? preset.order : index,
    slots,
    ...(performance ? { performance } : {}),
  }
}

/** Bentuk mentah dari DB → bentuk yang aman dipakai, sudah terurut. */
export function parsePrebuildConfig(value: unknown): PcPrebuildConfig {
  if (typeof value !== "object" || value === null) return EMPTY_PREBUILD_CONFIG

  const raw = value as Record<string, unknown>
  const presets = Array.isArray(raw.presets)
    ? raw.presets
        .map(toPreset)
        .filter((p): p is PcPrebuildPreset => p !== null)
        .sort((a, b) => a.order - b.order)
    : []

  return {
    // Bawaannya TERTUTUP. Lingkungan yang belum pernah menyimpan konfigurasi
    // ini tidak boleh diam-diam menerbitkan halaman berisi paket kosong.
    enabled: raw.enabled === true,
    presets,
  }
}

export async function getPcPrebuildConfig(): Promise<PcPrebuildConfig> {
  const fetcher = unstable_cache(
    async () => {
      const setting = await getPrisma().setting.findUnique({
        where: { key: PC_PREBUILD_SETTING_KEY },
      })
      return setting?.value ?? null
    },
    ["pc-prebuild-config"],
    { revalidate: 300, tags: [PC_PREBUILD_CACHE_TAG] }
  )

  return parsePrebuildConfig(await fetcher())
}

/** Preset tunggal, atau `null` kalau id-nya tidak ada. */
export async function getPcPrebuildPreset(id: string): Promise<PcPrebuildPreset | null> {
  const config = await getPcPrebuildConfig()
  return config.presets.find((preset) => preset.id === id) ?? null
}

/**
 * Seluruh productId yang dipakai sebuah preset — barang, variannya, dan pilihan
 * tukarnya.
 *
 * Terpusat di sini supaya pemanggil tidak perlu tahu bentuk bersarangnya. Satu
 * pemanggil yang lupa ikut mengambil id varian akan merender komponen bervarian
 * tanpa harga — dan nol rupiah di dalam total adalah kekeliruan yang tidak
 * punya gejala.
 */
export function collectPresetProductIds(preset: PcPrebuildPreset): number[] {
  const ids: number[] = []

  for (const slot of preset.slots) {
    for (const item of slot.items) {
      ids.push(item.productId)
      if (item.variationId) ids.push(item.variationId)
      for (const alt of item.alternatives) {
        ids.push(alt.productId)
        if (alt.variationId) ids.push(alt.variationId)
      }
    }
  }

  return ids
}

/**
 * Daftar game untuk grid estimasi FPS.
 *
 * Belum pernah disimpan → daftar bawaan. Sudah disimpan tapi kosong → memang
 * kosong; lihat alasannya di `parsePrebuildGames`.
 */
export async function getPcPrebuildGames(): Promise<PrebuildGame[]> {
  const fetcher = unstable_cache(
    async () => {
      const setting = await getPrisma().setting.findUnique({
        where: { key: PC_PREBUILD_GAMES_SETTING_KEY },
      })
      return setting?.value ?? null
    },
    ["pc-prebuild-games"],
    { revalidate: 300, tags: [PC_PREBUILD_GAMES_CACHE_TAG] }
  )

  return parsePrebuildGames(await fetcher()) ?? DEFAULT_PREBUILD_GAMES
}
