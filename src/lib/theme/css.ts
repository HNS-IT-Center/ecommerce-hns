import type { Theme, ThemeSurface } from "./types"

/**
 * Nilai warna yang boleh masuk ke CSS hasil generate.
 *
 * Whitelist ketat, BUKAN blacklist. Hasil fungsi di file ini ditulis ke halaman
 * lewat `dangerouslySetInnerHTML`, jadi nilai seperti
 * `red;} body { display:none } .x{color:red` akan menutup blok CSS lebih awal
 * dan menyuntik aturan sewenang-wenang ke seluruh situs.
 *
 * Di iterasi 1 semua nilai berasal dari konstanta di kode sehingga aman dengan
 * sendirinya — validasi ini dipasang sejak awal justru karena di iterasi 2
 * fungsi yang sama akan menerima input admin. Jauh lebih murah dipasang
 * sekarang daripada ditambal setelah jadi celah.
 */
const COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch|oklab|lab|lch)a?\([0-9a-z%.,\s/+-]*\))$/i

function isSafeColor(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && COLOR_PATTERN.test(value.trim())
}

/** Satu deklarasi CSS, atau string kosong kalau nilainya tidak lolos validasi. */
function declare(property: string, value: unknown): string {
  return isSafeColor(value) ? `${property}:${value.trim()};` : ""
}

/**
 * Petakan sebuah permukaan tema ke token semantik yang SUDAH dipakai komponen.
 *
 * Inilah inti rancangannya: kita tidak memperkenalkan variabel baru semacam
 * `--navbar-bg`, melainkan mendefinisikan ulang token yang ada di dalam scope
 * tertentu. Karena custom property diwarisi, semua `bg-background` di dalam
 * elemen ber-scope otomatis ikut berubah — tanpa satu pun className disentuh.
 */
function surfaceDeclarations(surface: ThemeSurface | undefined, kind: "chrome" | "card"): string {
  if (!surface) return ""

  // `chrome` memakai --background/--foreground (dipakai header, footer, dock),
  // sedangkan kartu produk memakai --card/--card-foreground.
  const bgToken = kind === "chrome" ? "--background" : "--card"
  const fgToken = kind === "chrome" ? "--foreground" : "--card-foreground"

  return [
    declare(bgToken, surface.bg),
    declare(fgToken, surface.fg),
    declare("--muted-foreground", surface.muted),
    declare("--border", surface.border),
    // `--muted` ikut diset ke warna latar yang sama. Footer memakai
    // `bg-muted/20`, bukan `bg-background`, jadi tanpa baris ini latarnya
    // tidak akan ikut bertema sementara header di sebelahnya berubah.
    // Nilainya sengaja sama dengan `bg` supaya permukaan chrome tetap satu
    // kesatuan warna.
    kind === "chrome" ? declare("--muted", surface.bg) : "",
    // `--accent` dipakai permukaan hover di beberapa komponen turunan.
    declare("--accent", surface.accent),
    declare("--accent-foreground", surface.accentFg),
  ].join("")
}

/**
 * Hasilkan CSS ber-scope untuk satu tema.
 *
 * `scope` adalah selektor kelas (mis. `.theme-chrome`). Semua deklarasi
 * dikurung di dalamnya, sehingga panel admin — yang tidak pernah membawa kelas
 * itu — tidak ikut terwarnai.
 */
export function themeToCss(theme: Theme, scope: "chrome" | "card"): string {
  const { tokens } = theme

  const body =
    scope === "chrome"
      ? [
          surfaceDeclarations(tokens.chrome, "chrome"),
          // Sakelar, bukan warna — lihat catatan di cabang `card` di bawah.
          tokens.chromeDecor === true ? "--chrome-decor:1;" : "",
        ].join("")
      : [
          surfaceDeclarations(tokens.card, "card"),
          declare("--card-price", tokens.cardPrice),
          declare("--card-badge-sale", tokens.cardBadgeSale),
          declare("--card-badge-sale-fold", tokens.cardBadgeSaleFold),
          declare("--card-badge-hot", tokens.cardBadgeHot),
          declare("--card-badge-hot-fold", tokens.cardBadgeHotFold),
          declare("--card-badge-new", tokens.cardBadgeNew),
          // Sakelar, bukan warna — nilainya tidak pernah berasal dari input
          // bebas, jadi tidak perlu (dan tidak bisa) lewat validasi warna.
          tokens.cardDecor === true ? "--card-decor:1;" : "",
        ].join("")

  const selector = scope === "chrome" ? ".theme-chrome" : ".theme-card"

  /**
   * Tema kosong menghasilkan blok RESET, bukan string kosong.
   *
   * Dulu di sini `if (!body) return ""`, dan itu sumber bug yang sulit dilacak:
   * tema "default" jadi berarti TIDAK ADA elemen `<style>` sama sekali. Selama
   * halamannya selalu dibuat ulang, itu tidak masalah. Tapi di produksi ada
   * lapisan cache di depan Next, dan HTML lama yang masih memegang `<style>`
   * tema sebelumnya tidak punya apa pun yang membatalkannya — karena keadaan
   * yang benar dinyatakan sebagai KETIADAAN markup, dan ketiadaan tidak bisa
   * menimpa apa pun.
   *
   * Gejalanya asimetris dan itu yang bikin membingungkan: berganti ke tema
   * berwarna terlihat langsung (HTML baru menambah `<style>`), sedangkan
   * kembali ke default seolah tidak berpengaruh sampai cache server dibersihkan
   * manual.
   *
   * Dengan blok reset, "default" menjadi instruksi yang aktif: token-nya
   * dikembalikan ke `initial` sehingga nilai global yang berlaku dipakai lagi.
   * Elemen `<style>` selalu ada, jadi yang berubah antar tema hanya ISINYA —
   * dan isi yang berubah selalu menimpa isi yang lama.
   */
  if (!body) {
    /**
     * DUA JENIS reset, dan membedakannya itu penting.
     *
     * (a) `initial` — untuk token yang nilainya DIWARISI dari `:root`/`.dark`
     *     (`--background`, `--card`, `--border`, …) dan untuk sakelar dekorasi
     *     yang pemakainya sudah menulis fallback sendiri (`var(--card-decor, 0)`).
     *     Di sini `initial` benar: elemen ber-scope berhenti punya nilai
     *     sendiri, jadi nilai warisan dari induknya yang berlaku.
     *
     * (b) `var(--x-default)` — untuk token WARNA kartu yang default globalnya
     *     didefinisikan di `:root` (lihat `globals.css`).
     *
     * Perbedaan ini pernah dilewatkan, dan akibatnya nyata: seluruh token
     * kartu di-reset dengan `initial`. Pada custom property, `initial` BUKAN
     * "pakai nilai global" melainkan guaranteed-invalid — dan karena
     * `.theme-card` lebih spesifik daripada `:root`, reset itu selalu menang.
     * `var(--card-badge-sale)` gagal resolve, sehingga badge diskon dan harga
     * yang seharusnya merah tampil abu-abu, justru pada tema "default".
     *
     * Menunjuk ke `--x-default` mempertahankan alasan blok reset ini dibuat
     * (elemen `<style>` SELALU ada, jadi isinya bisa menimpa versi lama di
     * cache) tanpa membuat nilainya menjadi tidak sah.
     */
    const reset =
      scope === "chrome"
        ? "--background:initial;--foreground:initial;--muted:initial;--muted-foreground:initial;--border:initial;--accent:initial;--accent-foreground:initial;--chrome-decor:initial;"
        : "--card:initial;--card-foreground:initial;--muted-foreground:initial;--border:initial;--accent:initial;--accent-foreground:initial;--card-decor:initial;" +
          "--card-price:var(--card-price-default);--card-badge-sale:var(--card-badge-sale-default);--card-badge-sale-fold:var(--card-badge-sale-fold-default);--card-badge-hot:var(--card-badge-hot-default);--card-badge-hot-fold:var(--card-badge-hot-fold-default);--card-badge-new:var(--card-badge-new-default);"
    return `${selector}{${reset}}`
  }

  return `${selector}{${body}}`
}

/**
 * Nilai untuk atribut `style` React pada pratinjau di panel admin.
 *
 * Memakai daftar token yang sama persis dengan `themeToCss`, supaya kotak
 * pratinjau memakai mekanisme yang identik dengan produksi — bukan tiruannya.
 */
export function themeToStyle(
  theme: Theme,
  scope: "chrome" | "card"
): React.CSSProperties {
  const css = themeToCss(theme, scope)
  if (!css) return {}

  const declarations = css.slice(css.indexOf("{") + 1, css.lastIndexOf("}"))
  const style: Record<string, string> = {}

  for (const chunk of declarations.split(";")) {
    if (!chunk) continue
    const separator = chunk.indexOf(":")
    if (separator === -1) continue
    style[chunk.slice(0, separator)] = chunk.slice(separator + 1)
  }

  return style as React.CSSProperties
}
