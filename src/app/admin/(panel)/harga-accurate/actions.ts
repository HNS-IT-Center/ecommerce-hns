"use server"

import { updateProductPriceAction } from "../produk/actions"
import { buildAccuratePricePreview } from "@/lib/services/accurate-price"
import { importDariSheet, type ImportResult } from "@/lib/api/accurate/import-sheet"

/**
 * Server actions untuk halaman /harga-accurate.
 *
 * Penerapan harga TIDAK menulis langsung ke katalog di sini — ia memanggil
 * `updateProductPriceAction` yang sudah ada (jalur update harga tunggal dari
 * daftar produk). Alasannya §2.3 (reuse) dan §2.7: satu-satunya jalur yang sah
 * untuk mengubah harga katalog sudah punya audit log + revalidate + cek auth,
 * dan menirunya di sini berarti dua jalur harga yang bisa menyimpang.
 *
 * `SP` Accurate → `regularPrice`. `salePrice` TIDAK disentuh (obral ditetapkan
 * staff terpisah, bukan dari Accurate).
 */

/**
 * Impor data barang dari Google Sheet ke accurate_products. Upsert yang TIDAK
 * menyentuh harga (lihat import-sheet.ts). Dipakai tombol "Import Data".
 */
export async function importSheetAction(): Promise<{
  hasil: ImportResult | null
  error: string | null
}> {
  try {
    const hasil = await importDariSheet()
    return { hasil, error: null }
  } catch (error) {
    return {
      hasil: null,
      error: error instanceof Error ? error.message : "Gagal impor dari Sheet.",
    }
  }
}

/** Muat ulang pratinjau (dipakai tombol "Segarkan"). READ-ONLY. */
export async function refreshPreviewAction() {
  try {
    const preview = await buildAccuratePricePreview()
    return { preview, error: null as string | null }
  } catch (error) {
    return {
      preview: null,
      error: error instanceof Error ? error.message : "Gagal memuat pratinjau harga.",
    }
  }
}

export type TerapkanItem = { wooId: number; regularPrice: number }
export type TerapkanHasil = {
  berhasil: number
  gagal: Array<{ wooId: number; alasan: string }>
}

/**
 * Terapkan harga terpilih ke katalog. Menerima daftar {wooId, regularPrice}
 * yang SUDAH divalidasi & dicentang staff di klien — tapi divalidasi ULANG di
 * sini (jangan percaya klien): harga wajib angka wajar > 0.
 *
 * Setiap baris lewat `updateProductPriceAction`, jadi tiap perubahan tercatat
 * di `product_logs` seperti perubahan harga manual.
 */
export async function terapkanHargaAction(
  items: TerapkanItem[],
): Promise<TerapkanHasil> {
  const hasil: TerapkanHasil = { berhasil: 0, gagal: [] }

  for (const item of items) {
    // Validasi ulang di server — klien tidak dipercaya (§2.7).
    if (!Number.isFinite(item.regularPrice) || item.regularPrice <= 0) {
      hasil.gagal.push({ wooId: item.wooId, alasan: "harga tidak wajar" })
      continue
    }

    const res = await updateProductPriceAction(item.wooId, item.regularPrice)
    if (res.error) {
      hasil.gagal.push({ wooId: item.wooId, alasan: res.error })
    } else {
      hasil.berhasil++
    }
  }

  return hasil
}
