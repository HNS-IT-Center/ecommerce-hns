import type { Theme } from "./types"

/**
 * Preset tema musiman.
 *
 * Disimpan sebagai konstanta di kode, BUKAN baris database, karena ini aset
 * desain — layak melewati review PR, punya riwayat diff, dan bisa di-rollback
 * lewat git. Menyimpannya di DB berarti salinan kanoniknya hidup di tempat yang
 * tidak punya satu pun dari itu, dan menuntut seed script yang harus idempoten
 * di tiap environment.
 *
 * Tema kustom buatan admin nanti (iterasi 2) disimpan terpisah di key
 * `THEME_CUSTOM`, lalu digabung: `[...PRESET_THEMES, ...customThemes]`.
 *
 * ATURAN saat menambah preset: `chrome` dan `card` harus diisi sebagai SATU SET
 * UTUH (bg + fg + muted + border). Mengisi sebagian menghasilkan kombinasi
 * seperti teks nyaris hitam di atas latar hijau tua — token yang tidak diisi
 * jatuh ke default terang dan kontrasnya jadi tidak terbaca.
 */
export const PRESET_THEMES: readonly Theme[] = [
  {
    id: "default",
    name: "Default",
    description: "Tampilan asli HNS IT Center.",
    // Sengaja kosong: "default" berarti tidak menyuntik CSS apa pun, sehingga
    // injektor tidak perlu kasus khusus untuk menanganinya.
    tokens: {},
  },
  {
    id: "christmas",
    name: "Natal",
    description: "Hiasan Natal di navbar, footer, dan dock. Latar tetap putih.",
    /**
     * Latar SENGAJA tidak diubah.
     *
     * Versi pertama tema ini mengecat navbar hijau cemara, dan itu keliru pada
     * dua hal. Pertama, mengubah `--muted-foreground` membuat teks footer ikut
     * kehijauan — padahal warna teks tidak seharusnya ikut berdandan. Kedua,
     * latar gelap memaksa seluruh kontras dihitung ulang, dan itu risiko
     * keterbacaan yang tidak sebanding dengan hasilnya.
     *
     * Yang dipakai sekarang: latar tetap putih, kemeriahan sepenuhnya datang
     * dari aset hiasan (lihat `components/theme/christmas-*`). Hanya aksen
     * merah pada harga & badge yang diubah — itu pun ke MERAH, warna yang
     * memang sudah dipakai kartu produk, jadi tidak ada yang terasa asing.
     */
    tokens: {
      cardPrice: "#c1121f",
      cardBadgeSale: "#c1121f",
      cardBadgeSaleFold: "#7d0b14",
      cardBadgeHot: "#0b6b4f",
      cardBadgeHotFold: "#064032",
      cardBadgeNew: "#c1121f",
    },
  },
  {
    id: "halloween",
    name: "Halloween",
    description: "Ungu gelap dengan aksen oranye labu.",
    tokens: {
      chrome: {
        bg: "#1a1024",
        fg: "#f7f0fb",
        muted: "#b09cc4",
        border: "#33204a",
        accent: "#ff7518",
        accentFg: "#1a1024",
      },
      card: {
        bg: "#ffffff",
        fg: "#241633",
        muted: "#6b5b7d",
        border: "#e2daea",
      },
      cardPrice: "#e2600c",
      cardBadgeSale: "#ff7518",
      cardBadgeSaleFold: "#a8460a",
      cardBadgeHot: "#7b2cbf",
      cardBadgeHotFold: "#4a1a73",
      cardBadgeNew: "#33204a",
    },
  },
  {
    id: "cny",
    name: "Imlek",
    description: "Merah keberuntungan dengan aksen emas.",
    tokens: {
      chrome: {
        bg: "#8b0000",
        fg: "#fff8e7",
        muted: "#e8c9a0",
        border: "#a82020",
        accent: "#ffd700",
        accentFg: "#5c0000",
      },
      card: {
        bg: "#ffffff",
        fg: "#3d0a0a",
        muted: "#8a5a5a",
        border: "#f0dcdc",
      },
      cardPrice: "#c1121f",
      cardBadgeSale: "#c1121f",
      cardBadgeSaleFold: "#7d0b14",
      cardBadgeHot: "#d4a017",
      cardBadgeHotFold: "#8a6810",
      cardBadgeNew: "#a82020",
    },
  },
  {
    id: "idul-fitri",
    name: "Idul Fitri",
    description: "Hijau toska lembut dengan aksen emas.",
    tokens: {
      chrome: {
        bg: "#0e5c56",
        fg: "#f2fbfa",
        muted: "#a5cfcb",
        border: "#177a72",
        accent: "#d4af37",
        accentFg: "#0b3a36",
      },
      card: {
        bg: "#ffffff",
        fg: "#0f332f",
        muted: "#5f7d7a",
        border: "#d9eae8",
      },
      cardPrice: "#c1121f",
      cardBadgeSale: "#c1121f",
      cardBadgeSaleFold: "#7d0b14",
      cardBadgeHot: "#d4af37",
      cardBadgeHotFold: "#8a7124",
      cardBadgeNew: "#177a72",
    },
  },
  {
    id: "kemerdekaan",
    name: "HUT Kemerdekaan RI",
    description: "Merah putih untuk perayaan 17 Agustus.",
    tokens: {
      chrome: {
        bg: "#ce1126",
        fg: "#ffffff",
        muted: "#f7c9ce",
        border: "#e04555",
        accent: "#ffffff",
        accentFg: "#ce1126",
      },
      card: {
        bg: "#ffffff",
        fg: "#2b0508",
        muted: "#7d5a5e",
        border: "#f2dcde",
      },
      cardPrice: "#ce1126",
      cardBadgeSale: "#ce1126",
      cardBadgeSaleFold: "#8a0b19",
      cardBadgeHot: "#b8860b",
      cardBadgeHotFold: "#7a5807",
      cardBadgeNew: "#e04555",
    },
  },
] as const

export const DEFAULT_THEME_ID = "default"

export function findPresetTheme(id: string): Theme | undefined {
  return PRESET_THEMES.find((theme) => theme.id === id)
}
