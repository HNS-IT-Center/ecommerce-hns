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
 * dipakai wizard. Kalau suatu step dihapus dari konfigurasi builder, item yang
 * menunjuknya diabaikan saat dimuat (lihat `resolvePrebuildSteps`).
 */
import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"

export const PC_PREBUILD_CACHE_TAG = "pc-prebuild-config"
export const PC_PREBUILD_SETTING_KEY = "PC_PREBUILD_CONFIG"

/** Satu komponen di dalam paket. Tanpa harga — lihat catatan di atas berkas. */
export type PcPrebuildItem = {
  stepId: string
  productId: number
  quantity: number
}

export type PcPrebuildPreset = {
  id: string
  name: string
  /** Satu kalimat yang muncul di kartu paket. Boleh kosong. */
  summary: string
  order: number
  items: PcPrebuildItem[]
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

/**
 * Satu item dianggap sah hanya kalau ketiga kolomnya bertipe benar.
 *
 * Kolom `value` di tabel `settings` bertipe JSON bebas, jadi tidak ada yang
 * menjamin bentuknya selain pemeriksaan ini. Baris cacat DIBUANG, bukan
 * diteruskan: halaman publik memetakan `productId` ke katalog, dan satu entri
 * yang bukan angka cukup untuk menggagalkan seluruh halaman.
 */
function isPrebuildItem(value: unknown): value is PcPrebuildItem {
  if (typeof value !== "object" || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.stepId === "string" &&
    typeof item.productId === "number" &&
    Number.isFinite(item.productId) &&
    typeof item.quantity === "number" &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  )
}

function toPreset(value: unknown, index: number): PcPrebuildPreset | null {
  if (typeof value !== "object" || value === null) return null
  const preset = value as Record<string, unknown>
  if (typeof preset.id !== "string" || typeof preset.name !== "string") return null

  const items = Array.isArray(preset.items) ? preset.items.filter(isPrebuildItem) : []

  return {
    id: preset.id,
    name: preset.name,
    summary: typeof preset.summary === "string" ? preset.summary : "",
    order: typeof preset.order === "number" && Number.isFinite(preset.order) ? preset.order : index,
    items,
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
