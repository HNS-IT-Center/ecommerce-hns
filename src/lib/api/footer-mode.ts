/**
 * Mode isi bagian bawah footer — pengaturan global yang diatur staff di
 * `/admin/toko` (22 Oktober 2026).
 *
 * Kenapa ada sakelar, bukan cukup mengganti kodenya: format "Alamat / No
 * Telepon / Email" diminta pihak luar untuk VERIFIKASI usaha, dan sesudah
 * verifikasinya beres footer perlu kembali menampilkan daftar cabang. Bolak-balik
 * lewat deploy berarti dua kali menunggu build untuk satu keputusan yang cuma
 * soal tampilan; lewat sakelar, staff memutuskannya sendiri dan langsung tayang.
 *
 * Polanya mengikuti `lib/api/stock-display.ts`: satu baris di tabel `settings`
 * (tanpa migrasi), dibaca lewat `unstable_cache` tanpa `cookies()`/`headers()`,
 * dan pembuangan cache-nya di lapisan action.
 */
import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"

export const FOOTER_MODE_SETTING_KEY = "FOOTER_MODE"
export const FOOTER_MODE_CACHE_TAG = "footer-mode"

/**
 * - `identitas` — nama PT + "Alamat :" (empat baris), "No Telepon :", "Email :"
 *   persis dalam format yang diminta untuk verifikasi (`COMPANY_ADDRESS_LINES`).
 * - `cabang` — footer sebelum 22 Oktober: blok "Kontak" (WA & email) di kolom
 *   kanan dan daftar cabang dari tabel `stores` beserta tautan Maps-nya.
 */
export type FooterMode = "identitas" | "cabang"

/**
 * Default `identitas`: itulah yang sedang tayang saat sakelar ini dibuat, dan
 * pemeriksa verifikasi mungkin sedang melihatnya. Deploy sakelar ini tidak
 * boleh diam-diam mengubah footer yang sedang diperiksa.
 */
export const DEFAULT_FOOTER_MODE: FooterMode = "identitas"

export function isFooterMode(value: unknown): value is FooterMode {
  return value === "identitas" || value === "cabang"
}

export async function getFooterMode(): Promise<FooterMode> {
  const fetcher = unstable_cache(
    async () => {
      const setting = await getPrisma().setting.findUnique({
        where: { key: FOOTER_MODE_SETTING_KEY },
      })
      return setting?.value ?? null
    },
    ["footer-mode"],
    { revalidate: 300, tags: [FOOTER_MODE_CACHE_TAG] },
  )

  const value = (await fetcher()) as { mode?: unknown } | null
  // Kolomnya JSON bebas; nilai asing jatuh ke default, bukan diteruskan.
  return isFooterMode(value?.mode) ? value.mode : DEFAULT_FOOTER_MODE
}

export async function saveFooterMode(mode: FooterMode): Promise<void> {
  await getPrisma().setting.upsert({
    where: { key: FOOTER_MODE_SETTING_KEY },
    update: { value: { mode } },
    create: { key: FOOTER_MODE_SETTING_KEY, value: { mode } },
  })
}
