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

/** Sama dengan format yang diterbitkan `buildQuoteCode()`. */
export const QUOTE_CODE_PATTERN = /^HNSPC-\d{6}-[A-Z0-9]{4}$/
