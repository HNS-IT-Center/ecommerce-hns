"use server"

import { revalidateTag } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import {
  PC_PREBUILD_CACHE_TAG,
  PC_PREBUILD_GAMES_CACHE_TAG,
  PC_PREBUILD_GAMES_SETTING_KEY,
  PC_PREBUILD_SETTING_KEY,
  parsePrebuildConfig,
} from "@/lib/pc-prebuild/config"
import { parsePrebuildGames } from "@/lib/pc-prebuild/games"
import { searchPrebuildProducts } from "@/lib/pc-prebuild/products"

/**
 * Tipe SENGAJA tidak di-re-export dari sini.
 *
 * Berkas ini bertanda `"use server"`, dan Turbopack memperlakukan SETIAP export
 * di dalamnya sebagai server action — termasuk `export type`. Build produksi
 * gagal dengan "Export … doesn't exist in target module", dan `tsc --noEmit`
 * TIDAK menangkapnya; hanya `next build` yang menangkapnya. Pelajaran yang sama
 * sudah ditulis di `pc-builder/actions.ts`.
 *
 * Importlah tipenya langsung dari `@/lib/pc-prebuild/config` atau
 * `@/lib/pc-prebuild/products`.
 */

/**
 * `revalidateTag`, BUKAN `revalidatePath`.
 *
 * Alasan yang sama seperti di `pc-builder/actions.ts`: `revalidatePath` untuk
 * satu halaman membuat halaman itu memegang entri invalidasinya sendiri dan
 * berhenti ikut tersegarkan oleh `revalidatePath("/", "layout")` milik tema —
 * sehingga mengganti tema terlihat di seluruh situs kecuali di halaman itu.
 */
function revalidatePcPrebuild() {
  revalidateTag(PC_PREBUILD_CACHE_TAG, "max")
}

/** Baca konfigurasi langsung dari DB, TANPA cache — lihat catatan di `simpanConfig`. */
async function bacaConfigSegar() {
  const setting = await getPrisma().setting.findUnique({
    where: { key: PC_PREBUILD_SETTING_KEY },
  })
  return parsePrebuildConfig(setting?.value ?? null)
}

async function simpanConfig(config: unknown) {
  // Divalidasi ulang di server, bukan dipercaya dari klien. Bentuk apa pun yang
  // tidak dikenali dibuang di sini, jadi kolom JSON-nya tidak pernah menampung
  // sesuatu yang nanti menggagalkan halaman publik saat dibaca.
  const bersih = parsePrebuildConfig(config)

  await getPrisma().setting.upsert({
    where: { key: PC_PREBUILD_SETTING_KEY },
    update: { value: bersih },
    create: { key: PC_PREBUILD_SETTING_KEY, value: bersih },
  })

  revalidatePcPrebuild()
  return bersih
}

export async function savePcPrebuildConfig(config: unknown) {
  const bersih = await simpanConfig(config)
  return { success: true as const, presets: bersih.presets.length }
}

/**
 * Simpan SATU paket, sisanya tidak disentuh.
 *
 * Editor sekarang berupa halaman per paket, jadi ia hanya memegang satu paket
 * di state-nya. Kalau ia mengirim seluruh konfigurasi, paket lain akan ditulis
 * ulang dari salinan yang dibaca saat halaman dibuka — dan perubahan yang
 * dilakukan di tab lain sejak itu hilang tanpa jejak.
 *
 * Konfigurasi dibaca ULANG dari DB di sini (bukan dari cache) tepat karena itu:
 * yang digabung harus keadaan terkini, bukan keadaan lima menit lalu yang
 * kebetulan masih tersimpan di `unstable_cache`.
 */
export async function savePcPrebuildPreset(preset: unknown) {
  if (typeof preset !== "object" || preset === null) {
    return { success: false as const, error: "Bentuk paket tidak dikenali." }
  }

  const id = (preset as Record<string, unknown>).id
  if (typeof id !== "string" || !id) {
    return { success: false as const, error: "Paket tanpa id tidak bisa disimpan." }
  }

  const config = await bacaConfigSegar()
  const lain = config.presets.filter((p) => p.id !== id)

  const bersih = await simpanConfig({
    ...config,
    presets: [...lain, preset],
  })

  const tersimpan = bersih.presets.find((p) => p.id === id)
  if (!tersimpan) {
    // Parser membuang paketnya — hampir selalu karena tidak ada satu pun
    // komponen yang sah. Dikatakan terus terang, bukan dilaporkan "berhasil":
    // staff yang mengira paketnya tersimpan akan menutup halaman dan kehilangan
    // seluruh pekerjaannya.
    return {
      success: false as const,
      error: "Paket belum punya komponen yang sah, jadi belum bisa disimpan.",
    }
  }

  return { success: true as const, preset: tersimpan }
}

export async function deletePcPrebuildPreset(id: string) {
  if (!id) return { success: false as const, error: "Id kosong." }

  const config = await bacaConfigSegar()
  await simpanConfig({ ...config, presets: config.presets.filter((p) => p.id !== id) })

  return { success: true as const }
}

/**
 * Sakelar tampil/tidaknya fitur ini ke pelanggan.
 *
 * Mematikan BUKAN menghapus: presetnya tetap tersimpan, hanya rute publiknya
 * yang ditutup. Pola yang sama dipakai `REGISTER_MANUAL_ENABLED`.
 */
export async function setPcPrebuildEnabled(enabled: boolean) {
  const config = await bacaConfigSegar()
  await simpanConfig({ ...config, enabled: enabled === true })
  return { success: true as const, enabled: enabled === true }
}

/**
 * Pencarian produk untuk pemilih komponen.
 *
 * Membungkus `searchPrebuildProducts` supaya panel (Client Component) bisa
 * memanggilnya tanpa endpoint API sendiri. Berbeda dari `fetchBuilderProducts`
 * milik wizard, jalur ini IKUT mengembalikan produk bertipe VARIABLE beserta
 * variannya — lihat alasannya di `lib/pc-prebuild/products.ts`.
 */
export async function searchPrebuildProductsAction(input: {
  categoryIds: number[]
  /** Aturan `dependSteps`/`dependAttributes` PC Builder — lihat `products.ts`. */
  requiredAttributeValueIds?: number[]
  searchQuery?: string
  limit?: number
  page?: number
}) {
  return searchPrebuildProducts(input)
}

/**
 * Daftar game untuk grid estimasi FPS.
 *
 * Disimpan ke barisnya sendiri, bukan ke `PC_PREBUILD_CONFIG` — lihat alasannya
 * di `lib/pc-prebuild/config.ts`. Tag yang disegarkan pun terpisah: menyunting
 * daftar game tidak perlu membatalkan cache seluruh paket.
 *
 * Daftar kosong DIHORMATI, tidak jatuh ke bawaan. Staff yang mengosongkannya
 * berarti tidak ingin grid FPS tampil; mengisinya ulang otomatis akan membuat
 * penghapusan terasa tidak berfungsi.
 */
export async function savePcPrebuildGames(games: unknown) {
  const bersih = parsePrebuildGames(games) ?? []

  await getPrisma().setting.upsert({
    where: { key: PC_PREBUILD_GAMES_SETTING_KEY },
    update: { value: bersih },
    create: { key: PC_PREBUILD_GAMES_SETTING_KEY, value: bersih },
  })

  revalidateTag(PC_PREBUILD_GAMES_CACHE_TAG, "max")
  return { success: true as const, games: bersih.length }
}
