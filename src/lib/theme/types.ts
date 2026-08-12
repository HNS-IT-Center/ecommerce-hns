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
  /**
   * Menyalakan hiasan chrome bertema — sekarang: ikon keranjang Sinterklas
   * di navbar.
   *
   * Sakelar, bukan warna. Menghasilkan `--chrome-decor:1` di dalam scope
   * `.theme-chrome`, dan CSS yang memilih ikonnya membaca variabel itu.
   */
  chromeDecor?: boolean
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
  /** Bayangan lipatan badge "NEW" — versi lebih gelap dari `cardBadgeNew`. */
  cardBadgeNewFold?: string
  /**
   * Menyalakan hiasan hover di kartu produk (untaian, pohon, manusia salju).
   *
   * Bukan warna, melainkan sakelar — karena itu tidak lewat `declare()` yang
   * memvalidasi warna. Satu-satunya nilai yang diterima adalah `true`, dan
   * hasilnya `--card-decor:1` di dalam scope `.theme-card`. Seluruh perilaku
   * hiasannya diatur CSS dari sana, jadi `ProductCard` tidak perlu tahu tema.
   */
  cardDecor?: boolean
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
