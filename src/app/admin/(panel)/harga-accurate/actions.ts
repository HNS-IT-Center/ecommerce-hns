"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/lib/auth"
import { updateProductPriceAction } from "../produk/actions"
import { buildAccuratePricePreview } from "@/lib/services/accurate-price"
import { importDariSheet, type ImportResult } from "@/lib/api/accurate/import-sheet"
import {
  simpanHargaInternal,
  cariProdukWeb,
  tautkanKode,
  type PerubahanHarga,
  type HasilSimpan,
  type CalonProdukWeb,
  type HasilTaut,
} from "@/lib/api/accurate/price-table"

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
    await requirePermission("harga-accurate", "edit")
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
    await requirePermission("harga-accurate", "view")
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

  // Penjaga izin: role tanpa "edit" di halaman ini tak boleh menerapkan harga
  // (§2.7). Kalau ditolak, seluruh item gagal dengan alasan izin — bukan
  // sebagian tembus. `updateProductPriceAction` juga punya requireAuth-nya
  // sendiri, tapi penjaga di sini menutup celah "boleh login tapi tak boleh edit".
  try {
    await requirePermission("harga-accurate", "edit")
  } catch {
    for (const item of items) hasil.gagal.push({ wooId: item.wooId, alasan: "tidak punya izin edit harga" })
    return hasil
  }

  for (const item of items) {
    // Validasi ulang di server — klien tidak dipercaya (§2.7).
    if (!Number.isFinite(item.regularPrice) || item.regularPrice <= 0) {
      hasil.gagal.push({ wooId: item.wooId, alasan: "harga tidak wajar" })
      continue
    }

    /**
     * Dicatat sebagai `SYNC_PRICE`, bukan `UPDATE_PRICE`.
     *
     * Inilah yang membuat aturan "suntingan di web menang" (docs/13 §6) bisa
     * bekerja sama sekali: pratinjau membedakan harga milik manusia dari harga
     * hasil sinkronisasi dengan membandingkan dua aksi itu di `product_logs`.
     * Kalau penerapan ikut menulis `UPDATE_PRICE`, sesudah sinkronisasi pertama
     * SETIAP produk akan tampak disunting manusia — dan sinkronisasi berikutnya
     * melewati semuanya tanpa ada yang mengerti kenapa.
     */
    const res = await updateProductPriceAction(item.wooId, item.regularPrice, undefined, {
      priceAction: "SYNC_PRICE",
    })
    if (res.error) {
      hasil.gagal.push({ wooId: item.wooId, alasan: res.error })
    } else {
      hasil.berhasil++
    }
  }

  return hasil
}

/**
 * Simpan harga modal (CP) & dealer di tabel kerja Accurate.
 *
 * BUKAN jalur harga katalog. Keduanya angka INTERNAL — modal adalah yang kita
 * bayar ke pemasok, dealer adalah harga untuk pembeli B2B — dan tidak satu pun
 * pernah tampil ke pembeli di web. Karena itu ia tidak lewat
 * `updateProductPriceAction` seperti penerapan SRP di atas: tidak ada harga
 * pelanggan yang berubah, jadi tidak ada yang perlu masuk `product_logs`
 * maupun memicu revalidate halaman produk.
 *
 * Harga jual (`SP`/SRP) TIDAK bisa disentuh dari sini — §2.7 menaruhnya di
 * jalur katalog ber-audit-log.
 */
export async function simpanHargaInternalAction(
  perubahan: PerubahanHarga[],
): Promise<{ hasil: HasilSimpan | null; error: string | null }> {
  try {
    await requirePermission("harga-accurate", "edit")
  } catch {
    return { hasil: null, error: "Anda tidak punya izin mengubah harga di halaman ini." }
  }

  /**
   * Izin harga modal diperiksa TERPISAH — ia kolom yang berbeda haknya, bukan
   * bagian dari izin halaman. Yang tak punya izin tetap boleh menyimpan harga
   * dealer; kolom `CP` yang tidak ikut ditulis (lihat `simpanHargaInternal`).
   *
   * Diperiksa di sini, bukan dipercayakan pada kolom yang disembunyikan di
   * layar: server action bisa dipanggil langsung tanpa pernah memuat halaman
   * yang menyembunyikannya.
   */
  let bolehUbahModal = false
  try {
    await requirePermission("harga-modal", "edit")
    bolehUbahModal = true
  } catch {
    bolehUbahModal = false
  }

  if (perubahan.length === 0) {
    return { hasil: { tersimpan: 0, gagal: [] }, error: null }
  }

  try {
    const hasil = await simpanHargaInternal(perubahan, { bolehUbahModal })
    // Halaman ini `force-dynamic`, tapi revalidate tetap dipanggil supaya
    // pembaca lain (tab yang sedang terbuka di komputer lain) tidak menyajikan
    // angka yang sudah berubah dari cache router.
    revalidatePath("/admin/harga-accurate")
    return { hasil, error: null }
  } catch (error) {
    return {
      hasil: null,
      error: error instanceof Error ? error.message : "Gagal menyimpan harga.",
    }
  }
}

/**
 * Cari produk web untuk ditautkan ke satu kode Accurate.
 *
 * READ-ONLY, jadi cukup izin "view" halaman ini — staff yang boleh melihat
 * tabel harga boleh mencari padanannya, walau belum tentu boleh menautkan.
 */
export async function cariProdukWebAction(
  q: string,
): Promise<{ hasil: CalonProdukWeb[]; error: string | null }> {
  try {
    await requirePermission("harga-accurate", "view")
    return { hasil: await cariProdukWeb(q), error: null }
  } catch (error) {
    return {
      hasil: [],
      error: error instanceof Error ? error.message : "Gagal mencari produk.",
    }
  }
}

/**
 * Tautkan (atau lepas) kode Accurate pada satu produk web.
 *
 * Menulis ke `products.accurate_code` — kolom penambat, BUKAN harga. Karena itu
 * ia tidak lewat `updateProductPriceAction`: tidak ada harga pelanggan yang
 * berubah, jadi tidak ada yang perlu masuk `product_logs` maupun memicu
 * revalidate halaman produk.
 *
 * Yang berubah justru bisa membuat harga MENDARAT DI PRODUK YANG SALAH kalau
 * dipasang keliru, jadi izinnya "edit", bukan "view".
 */
export async function tautkanKodeAction(input: {
  wooId: number
  kode: string | null
}): Promise<HasilTaut> {
  try {
    await requirePermission("harga-accurate", "edit")
  } catch {
    return { ok: false, alasan: "Anda tidak punya izin menautkan produk." }
  }

  if (!Number.isInteger(input.wooId) || input.wooId <= 0) {
    return { ok: false, alasan: "Produk web tidak dikenali." }
  }

  try {
    const hasil = await tautkanKode(input.wooId, input.kode)
    if (hasil.ok) revalidatePath("/admin/harga-accurate")
    return hasil
  } catch (error) {
    return {
      ok: false,
      alasan: error instanceof Error ? error.message : "Gagal menautkan.",
    }
  }
}
