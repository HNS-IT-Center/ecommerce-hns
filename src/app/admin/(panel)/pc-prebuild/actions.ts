"use server"

import { revalidateTag } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import {
  PC_PREBUILD_CACHE_TAG,
  PC_PREBUILD_SETTING_KEY,
  parsePrebuildConfig,
} from "@/lib/pc-prebuild/config"

/**
 * Tipe SENGAJA tidak di-re-export dari sini.
 *
 * Berkas ini bertanda `"use server"`, dan Turbopack memperlakukan SETIAP export
 * di dalamnya sebagai server action — termasuk `export type`. Build produksi
 * gagal dengan "Export … doesn't exist in target module", dan `tsc --noEmit`
 * TIDAK menangkapnya; hanya `next build` yang menangkapnya. Pelajaran yang sama
 * sudah ditulis di `pc-builder/actions.ts`.
 *
 * Importlah tipenya langsung dari `@/lib/pc-prebuild/config`.
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

export async function savePcPrebuildConfig(config: unknown) {
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
  return { success: true as const, presets: bersih.presets.length }
}
