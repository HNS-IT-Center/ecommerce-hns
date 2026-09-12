/**
 * Mode tampilan stok — pengaturan global yang diatur staff di `/admin/produk`.
 *
 * Nilainya menempel di tabel `settings` (bukan kolom baru di `products`), jadi
 * satu sakelar berlaku untuk seluruh katalog dan tidak butuh migrasi. Polanya
 * mengikuti `lib/theme/settings.ts`: dibaca lewat `unstable_cache` dan TIDAK
 * menyentuh `cookies()`/`headers()`, supaya halaman storefront tetap statis/ISR.
 *
 * Yang berubah hanyalah APA YANG DITAMPILKAN. `stockStatus` di database tidak
 * pernah ikut ditulis ulang — panel admin, log produk, dan hasil impor tetap
 * memperlihatkan stok yang sebenarnya. Kalau sakelarnya dikembalikan, tampilan
 * pelanggan kembali jujur tanpa ada data yang perlu dipulihkan.
 *
 * `revalidateTag`/`revalidatePath` sengaja tidak dipanggil dari berkas ini,
 * melainkan dari lapisan action — supaya fungsinya tetap bisa dipakai dari
 * script tanpa menyeret konteks request.
 */
import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import type { ProductVariation } from "@/types/woocommerce"

export const STOCK_DISPLAY_SETTING_KEY = "STOCK_DISPLAY_MODE"
export const STOCK_DISPLAY_CACHE_TAG = "stock-display-mode"

/**
 * - `actual` — stok apa adanya: barang kosong bertanda "Stok Habis".
 * - `always_available` — barang kosong tetap tampil sebagai "Tersedia" dan
 *   tetap bisa dipesan (indent). Barangnya TIDAK disembunyikan dari katalog.
 */
export type StockDisplayMode = "actual" | "always_available"

/**
 * Default sengaja `actual`: selama staff belum menekan apa pun, situs
 * berperilaku persis seperti sebelum sakelar ini ada.
 */
export const DEFAULT_STOCK_DISPLAY_MODE: StockDisplayMode = "actual"

/**
 * Angka stok yang dipinjamkan saat mode `always_available` menutupi stok kosong.
 *
 * Perlu angka, bukan sekadar boolean, karena beberapa layar menurunkan
 * ketersediaan dari `stock > 0` dan PC Builder membatasi kuantitas dengan
 * `quantity >= stock`. Nilainya cukup besar supaya pembatas itu tidak menahan
 * pesanan yang memang sengaja dibolehkan.
 */
const ASSUMED_STOCK = 99

export function isStockDisplayMode(value: unknown): value is StockDisplayMode {
  return value === "actual" || value === "always_available"
}

export async function getStockDisplayMode(): Promise<StockDisplayMode> {
  const fetcher = unstable_cache(
    async () => {
      const setting = await getPrisma().setting.findUnique({
        where: { key: STOCK_DISPLAY_SETTING_KEY },
      })
      return setting?.value ?? null
    },
    ["stock-display-mode"],
    { revalidate: 300, tags: [STOCK_DISPLAY_CACHE_TAG] }
  )

  const value = (await fetcher()) as { mode?: unknown } | null

  // Kolomnya JSON bebas. Nilai asing dikembalikan ke default, bukan diteruskan
  // — mode yang tidak dikenali akan membuat helper di bawah diam-diam berhenti
  // menutupi stok tanpa penjelasan apa pun.
  return isStockDisplayMode(value?.mode) ? value.mode : DEFAULT_STOCK_DISPLAY_MODE
}

export async function saveStockDisplayMode(mode: StockDisplayMode): Promise<void> {
  await getPrisma().setting.upsert({
    where: { key: STOCK_DISPLAY_SETTING_KEY },
    update: { value: { mode } },
    create: { key: STOCK_DISPLAY_SETTING_KEY, value: { mode } },
  })
}

/**
 * Status stok bentuk WooCommerce (`"instock"` / `"outofstock"` / `"onbackorder"`)
 * sebagaimana yang boleh dilihat pelanggan.
 */
export function displayStockStatus<T extends string>(
  status: T,
  mode: StockDisplayMode
): T | "instock" {
  return mode === "always_available" ? "instock" : status
}

/** Jumlah stok sebagaimana yang boleh dilihat pelanggan. */
export function displayStockCount(stock: number, mode: StockDisplayMode): number {
  if (mode === "always_available" && stock <= 0) return ASSUMED_STOCK
  return stock
}

/**
 * Sisa stok yang boleh ditulis di halaman produk ("Tersedia (Sisa 3)").
 *
 * Saat stok kosong sedang ditutupi, angkanya dibuang — bukan diganti. Menulis
 * "Tersedia (Sisa 0)" justru membocorkan yang disembunyikan sekaligus terbaca
 * seperti kesalahan sistem, dan mengarang angka sisa berarti menjanjikan
 * jumlah yang tidak ada dasarnya.
 */
export function displayStockQuantity(
  status: string,
  quantity: number | null | undefined,
  mode: StockDisplayMode
): number | null {
  if (mode === "always_available" && status !== "instock") return null
  return quantity ?? null
}

/**
 * Varian produk sebagaimana yang boleh dilihat pelanggan.
 *
 * Dipakai bersama oleh halaman produk dan endpoint varian Quick View, supaya
 * keduanya tidak bisa berbeda pendapat soal varian mana yang tampak tersedia.
 */
export function displayVariationStock(
  variation: ProductVariation,
  mode: StockDisplayMode
): ProductVariation {
  if (mode === "actual") return variation

  return {
    ...variation,
    stock_status: "instock",
    stock_quantity: displayStockQuantity(variation.stock_status, variation.stock_quantity, mode),
  }
}
