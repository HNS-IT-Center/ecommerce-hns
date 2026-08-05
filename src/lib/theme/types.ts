/**
 * Tipe untuk Theme Editor.
 *
 * Tema TIDAK menimpa 55 nilai ramp warna (`--primary-500`, `--accent-100`, dst),
 * melainkan layer semantik di atasnya (`--background`, `--foreground`, ...).
 * Alasannya dua: admin tidak mungkin menyusun 55 hex secara waras, dan menimpa
 * satu nilai ramp merembet jauh melampaui yang diniatkan — mengubah
 * `--primary-500` ikut menyeret `--ring`, `--sidebar-primary`, dan `--chart-1`.
 */

/** Satu permukaan UI: latar, teks, garis, dan aksennya. */
export type ThemeSurface = {
  bg?: string
  fg?: string
  muted?: string
  border?: string
  accent?: string
  accentFg?: string
}

/**
 * Semua field opsional dan itu disengaja: field yang tidak diisi jatuh ke token
 * global yang berlaku sekarang. Preset yang cuma ingin mewarnai header cukup
 * mengisi `chrome`, sisanya dibiarkan apa adanya.
 */
export type ThemeTokens = {
  /** Header, Footer, dan Mobile Dock — dikendalikan tab pertama. */
  chrome?: ThemeSurface
  /** Kartu produk — dikendalikan tab kedua. */
  card?: ThemeSurface
  /** Warna harga diskon di kartu produk. */
  cardPrice?: string
  /** Isi badge diskon (yang terlipat di pojok kiri atas). */
  cardBadgeSale?: string
  /** Bayangan lipatan badge diskon — versi lebih gelap dari `cardBadgeSale`. */
  cardBadgeSaleFold?: string
  /** Isi badge "HOT". */
  cardBadgeHot?: string
  /** Bayangan lipatan badge "HOT". */
  cardBadgeHotFold?: string
  /** Isi badge "NEW". */
  cardBadgeNew?: string
}

export type Theme = {
  id: string
  /** Nama yang tampil di panel admin. */
  name: string
  description?: string
  tokens: ThemeTokens
}

/**
 * Yang benar-benar tersimpan di database — hanya dua string.
 *
 * Dipisah `chrome` dan `card` supaya admin bisa, misalnya, memasang nuansa
 * Idul Fitri di header sambil membiarkan kartu produk tetap netral.
 */
export type ThemeSettings = {
  activeChromeThemeId: string
  activeCardThemeId: string
}
