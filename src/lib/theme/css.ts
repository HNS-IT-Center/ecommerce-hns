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

  if (!body) return ""

  const selector = scope === "chrome" ? ".theme-chrome" : ".theme-card"
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
