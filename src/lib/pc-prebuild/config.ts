/**
 * Lapisan data untuk paket "PC Prebuild" — rakitan siap pakai yang disusun
 * staff, lalu dimuat ke wizard `/build-pc` dan boleh diubah pelanggan.
 *
 * Mengikuti konvensi `lib/pc-builder/config.ts`: pembacaan lewat
 * `unstable_cache` bertag, dan `revalidateTag` TIDAK dipanggil dari sini
 * melainkan dari lapisan action — supaya berkas ini tetap bisa dipakai dari
 * skrip tanpa menyeret konteks request.
 *
 * **Preset TIDAK menyimpan harga.** Isinya hanya `productId` dan `quantity`;
 * harga selalu dibaca ulang dari katalog saat halaman dirender. Ini keharusan
 * CLAUDE.md §2.7, bukan pilihan gaya: preset yang menyimpan angka akan
 * menampilkan harga yang benar hari ini dan salah bulan depan tanpa ada yang
 * menyadarinya. Persis itu yang pernah terjadi pada panel "My Build" yang
 * membaca harga dari localStorage (diperbaiki di commit 9f45230).
 *
 * **Langkahnya menumpang `PC_BUILDER_CONFIG`.** Tidak ada daftar langkah kedua
 * yang perlu dijaga — `stepId` di sini menunjuk step yang sama dengan yang
 * dipakai wizard.
 *
 * ## Dua bentuk masuk, satu bentuk keluar
 *
 * Parser menerima bentuk LAMA (`items: [{ stepId, productId, quantity }]`) dan
 * bentuk BARU (`slots: [{ stepId, options: [...] }]`), tapi selalu
 * mengeluarkan bentuk baru. `savePcPrebuildConfig` menjalankan parser ini
 * sebelum menulis, jadi setiap penyimpanan menormalkan datanya.
 *
 * Kalau tidak begitu, dua bentuk akan hidup berdampingan di kolom `settings`
 * selamanya dan setiap pembaca berikutnya harus tahu keduanya.
 */
import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import { MAX_BRANCHING_SLOTS, MAX_OPTIONS_PER_SLOT } from "./limits"

export const PC_PREBUILD_CACHE_TAG = "pc-prebuild-config"
export const PC_PREBUILD_SETTING_KEY = "PC_PREBUILD_CONFIG"

// Batasnya tinggal di berkas sendiri supaya panel admin (Client Component)
// bisa memakainya tanpa menyeret Prisma ke bundle browser. Lihat limits.ts.
export { MAX_BRANCHING_SLOTS, MAX_OPTIONS_PER_SLOT } from "./limits"

export type PcPrebuildOption = {
  productId: number
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

export type PcPrebuildSlot = {
  stepId: string
  /**
   * Satu pilihan = komponen tetap. Lebih dari satu = pelanggan memilih, dan
   * yang PERTAMA adalah bawaan.
   *
   * TIDAK PERNAH kosong: slot tanpa pilihan tidak punya arti, jadi dilewati
   * saat dibaca dan ditolak saat disimpan.
   *
   * `productId` tidak boleh kembar di dalam satu slot. Pilihan diidentifikasi
   * lewat `productId` — termasuk di URL — jadi dua pilihan dengan produk yang
   * sama tidak bisa dibedakan satu sama lain.
   */
  options: PcPrebuildOption[]
}

export type PcPrebuildPreset = {
  id: string
  name: string
  summary: string
  /**
   * Foto rakitan jadi, hasil unggah ke Cloudflare R2 lewat POST /api/admin/media
   * — satu-satunya jalur unggah foto di project ini (CLAUDE.md §2.2).
   *
   * Yang disimpan URL-nya saja. Foto komponen satu per satu sudah ada di
   * katalog; ini foto PC-nya UTUH, yang justru paling menentukan kesan
   * pelanggan dan tidak bisa disusun dari foto komponen.
   */
  image?: string
  order: number
  slots: PcPrebuildSlot[]
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

/**
 * Satu pilihan dianggap sah hanya kalau produk dan jumlahnya bertipe benar.
 *
 * Kolom `value` di tabel `settings` bertipe JSON bebas, jadi tidak ada yang
 * menjamin bentuknya selain pemeriksaan ini. Baris cacat DIBUANG, bukan
 * diteruskan: halaman publik memetakan `productId` ke katalog, dan satu entri
 * yang bukan angka cukup untuk menggagalkan seluruh halaman.
 */
function toOption(value: unknown): PcPrebuildOption | null {
  if (typeof value !== "object" || value === null) return null
  const opt = value as Record<string, unknown>
  // `> 0` penting: panel admin membuat baris pilihan kosong dengan productId 0
  // sebagai penampung sementara. Baris yang tidak pernah diisi harus mati di
  // sini, bukan tersimpan sebagai pilihan yang tidak menunjuk produk apa pun.
  if (!angkaSah(opt.productId) || opt.productId <= 0) return null
  if (!angkaSah(opt.quantity) || opt.quantity <= 0) return null

  const label = typeof opt.label === "string" ? opt.label.trim() : ""

  return {
    productId: opt.productId,
    quantity: opt.quantity,
    ...(label ? { label } : {}),
  }
}

/** Buang pilihan berproduk kembar, lalu potong ke batas. */
function rapikanOptions(raw: unknown[]): PcPrebuildOption[] {
  const hasil: PcPrebuildOption[] = []
  const sudahAda = new Set<number>()

  for (const kandidat of raw) {
    const option = toOption(kandidat)
    if (!option) continue
    if (sudahAda.has(option.productId)) continue
    sudahAda.add(option.productId)
    hasil.push(option)
    if (hasil.length >= MAX_OPTIONS_PER_SLOT) break
  }

  return hasil
}

function toSlot(value: unknown): PcPrebuildSlot | null {
  if (typeof value !== "object" || value === null) return null
  const slot = value as Record<string, unknown>
  if (typeof slot.stepId !== "string" || !slot.stepId) return null
  if (!Array.isArray(slot.options)) return null

  const options = rapikanOptions(slot.options)
  if (options.length === 0) return null

  return { stepId: slot.stepId, options }
}

/**
 * Bentuk LAMA: satu produk per langkah, tanpa percabangan.
 *
 * Dibaca jadi slot berisi tepat satu pilihan. Tidak ada data yang hilang, dan
 * penyimpanan berikutnya dari panel admin menuliskannya dalam bentuk baru.
 */
function itemLamaToSlot(value: unknown): PcPrebuildSlot | null {
  if (typeof value !== "object" || value === null) return null
  const item = value as Record<string, unknown>
  if (typeof item.stepId !== "string" || !item.stepId) return null

  const option = toOption(item)
  if (!option) return null

  return { stepId: item.stepId, options: [option] }
}

/** Gabungkan slot ber-stepId sama, lalu tegakkan batas slot bercabang. */
function rapikanSlots(slots: PcPrebuildSlot[]): PcPrebuildSlot[] {
  const perStep = new Map<string, PcPrebuildSlot>()

  for (const slot of slots) {
    const ada = perStep.get(slot.stepId)
    if (!ada) {
      perStep.set(slot.stepId, slot)
      continue
    }
    // Satu langkah hanya boleh punya satu slot. Pilihan dari entri kembar
    // digabung, bukan dibuang — bentuk lama bisa memuat langkah yang sama dua
    // kali, dan membuangnya diam-diam akan menghilangkan komponen.
    ada.options = rapikanOptions([...ada.options, ...slot.options])
  }

  // Kalau slot bercabangnya lebih dari batas, yang berlebih DIKUNCI ke
  // bawaannya — bukan dibuang. Paketnya tetap utuh, cuma berhenti bercabang.
  let bercabang = 0
  return [...perStep.values()].map((slot) => {
    if (slot.options.length <= 1) return slot
    bercabang += 1
    return bercabang <= MAX_BRANCHING_SLOTS ? slot : { ...slot, options: [slot.options[0]] }
  })
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

  // `slots` menang kalau ada. `items` hanya dipakai untuk data yang ditulis
  // sebelum percabangan ada.
  const slots = rapikanSlots(dariSlots.length > 0 ? dariSlots : dariItems)

  const image = typeof preset.image === "string" ? preset.image.trim() : ""

  return {
    id: preset.id,
    name: preset.name,
    summary: typeof preset.summary === "string" ? preset.summary : "",
    ...(image ? { image } : {}),
    order: angkaSah(preset.order) ? preset.order : index,
    slots,
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
