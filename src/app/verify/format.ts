/**
 * Tanggal quotation di /verify, dikunci ke WIB.
 *
 * Zona waktunya eksplisit karena teks yang sama dirender di server (UTC di
 * hosting) dan di browser kasir (dropdown pencarian). Tanpa zona yang sama,
 * quotation yang dicetak pukul 01.00 WIB tampil bertanggal kemarin di grid,
 * tapi bertanggal hari ini di dropdown.
 */
const DATE_TIME = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
})

const DATE_LONG = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
})

/** `4 Agu 2026, 14.05` */
export function formatQuoteDateTime(value: Date | string): string {
  return DATE_TIME.format(new Date(value))
}

/** `4 Agustus 2026` */
export function formatQuoteDateLong(value: Date | string): string {
  return DATE_LONG.format(new Date(value))
}

/**
 * Dua format kode, dan KEDUANYA harus tetap diterima selamanya.
 *
 * - `HNSPC-20260921-0001` — nomor urut, sejak 21 September 2026.
 * - `HNSPC-260804-7K3M` — warisan: tanggal 6 digit + 4 karakter dari hash isi.
 *
 * Yang kedua bukan sisa yang menunggu dibersihkan. Ratusan PDF berformat lama
 * sudah ada di tangan pelanggan, dan satu-satunya gunanya kode di kertas itu
 * adalah bisa dicek di /verify. Menyempitkan pola ini berarti dokumen yang sah
 * ditolak sebagai "kode tidak valid" oleh toko yang menerbitkannya sendiri.
 *
 * `\d{4,}`, bukan `\d{4}`: nomor urut boleh melewati 9999 dalam satu bulan.
 */
export const QUOTE_CODE_PATTERN = /^HNSPC-(\d{8}-\d{4,}|\d{6}-[A-Z0-9]{4})$/
