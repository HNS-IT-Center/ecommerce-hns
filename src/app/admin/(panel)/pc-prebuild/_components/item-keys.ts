import type { PrebuildPickerProduct } from "@/lib/pc-prebuild/products"

/**
 * Kunci identitas satu barang — HARUS sama persis dengan `kunciBarang` di
 * [`lib/pc-prebuild/config.ts`](../../../../../lib/pc-prebuild/config.ts).
 *
 * Parser membuang baris yang kuncinya kembar saat menyimpan (`rapikanItems` dan
 * `rapikanAlternatives`). Panel memakai kunci yang sama supaya kejadian itu
 * terlihat SEBELUM tombol simpan ditekan — sebelumnya pembuangannya tanpa
 * jejak: staff menyusun dua pilihan, menyimpan, dan yang kembali cuma satu.
 *
 * Kalau rumus kunci di parser berubah, ubah juga di sini. Dua rumus yang
 * berbeda lebih buruk daripada tidak ada peringatan sama sekali: panel akan
 * menenangkan staff tentang baris yang tetap dibuang.
 */
export function kunciBarang(ref: { productId: number; variationId?: number }): string {
  return `${ref.productId}~${ref.variationId ?? 0}`
}

/**
 * Varian bawaan saat sebuah produk baru dipilih: varian pertama yang BELUM
 * dipakai baris lain di lingkup yang sama.
 *
 * Memakai `variations[0]` apa adanya membuat baris kedua dari produk yang sama
 * selalu lahir kembar dengan baris pertama, lalu dibuang saat simpan — itulah
 * yang membuat "SSD 1TB atau 2TB" sebagai pilihan tukar tidak bisa dinyatakan
 * sama sekali.
 *
 * Kalau semua variannya sudah terpakai, tetap kembalikan yang pertama:
 * barisnya akan ditandai kembar dan staff yang memutuskan, bukan panel yang
 * diam-diam menolak memilih apa pun. Barang tanpa varian mengembalikan
 * `undefined` — induk SIMPLE memang tidak punya varian.
 */
export function varianBawaan(
  p: PrebuildPickerProduct,
  terpakai: Set<string>
): number | undefined {
  const bebas = p.variations.find(
    (v) => !terpakai.has(kunciBarang({ productId: p.id, variationId: v.id }))
  )
  return (bebas ?? p.variations[0])?.id
}
