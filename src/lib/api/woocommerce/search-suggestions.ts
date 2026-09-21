import type { Product, GetProductsParams } from "@/types/woocommerce";
import { getProductsPaginated } from "./products";

/**
 * Saran produk untuk halaman pencarian yang hasilnya NOL.
 *
 * Kenapa ada: pelanggan HNS sering mengetik kode model persis ("G614JV") —
 * sinyal beli paling kuat yang bisa diberikan seseorang — lalu halamannya
 * menjawab "tidak ditemukan" dan berhenti di situ. Padahal keluarga produk yang
 * sama biasanya ADA di katalog ("ASUS ROG STRIX G16 G614PH"), cuma varian yang
 * diketik itu berstatus private atau memang belum pernah masuk.
 *
 * Yang SENGAJA tidak dilakukan: menampilkan produk acak/terbaru dari toko
 * sebagai pengisi halaman kosong. Itu membuat pelanggan mengira barang yang ia
 * cari tersedia. Saran di sini selalu berasal dari kata kunci yang dilonggarkan
 * secara terukur, dan pemanggilnya wajib memberi label bahwa ini BUKAN hasil
 * persis (lihat `SearchEmptyState`).
 */

/** Panjang minimum sisa kode model setelah dipotong — di bawah ini terlalu kabur. */
const MIN_TRIMMED_LENGTH = 4;

/** Batas jumlah varian kata kunci yang dihasilkan. */
const MAX_VARIANTS = 6;

/**
 * Batas percobaan kueri. Tiap percobaan = satu `getProductsPaginated` (masih
 * lewat `unstable_cache`), dan ini hanya berjalan di jalur nol-hasil.
 *
 * Angkanya 6, bukan 4: dengan 4, urutan percobaan untuk kata kunci berfilter
 * terpotong tepat sebelum tahap yang paling sering berhasil — "kata kunci
 * longgar TANPA filter". Diuji dengan `?q=G614JV&maxPrice=1000000`: batas 4
 * membuat halaman itu tidak memberi satu pun saran, padahal G614PH ada.
 */
const MAX_ATTEMPTS = 6;

/**
 * Token seperti "G614JV", "RTX4060", "P2426H" — campuran huruf & angka.
 * Hanya token semacam ini yang boleh dipotong per karakter; memotong kata biasa
 * akan mengubah "monitor" jadi "monito" dan tidak menolong siapa pun.
 */
function isModelCode(token: string): boolean {
  return /[a-z]/i.test(token) && /\d/.test(token);
}

/**
 * Menyusun kata kunci pengganti, dari yang paling dekat dengan aslinya ke yang
 * paling longgar. Aslinya sendiri tidak ikut — pemanggil sudah mencobanya.
 *
 * Dua strategi, berurutan:
 *   1. Ekor kode model dipangkas satu per satu, kata lain dipertahankan.
 *      "ASUS ROG G614JV" → "ASUS ROG G614J" → "ASUS ROG G614"
 *   2. Kata dibuang dari belakang. "ASUS ROG G614JV" → "ASUS ROG" → "ASUS"
 *
 * Kata dibuang dari BELAKANG, bukan dari depan, karena orang menulis dari yang
 * umum ke yang spesifik ("laptop asus g614jv"): sisa depan tetap masuk akal
 * sebagai pencarian, sisa belakang tidak.
 */
export function buildRelaxedQueries(query: string): string[] {
  const normalized = query.trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const variants: string[] = [];
  const push = (candidate: string) => {
    const value = candidate.trim();
    if (!value || value === normalized || variants.includes(value)) return;
    variants.push(value);
  };

  const lastToken = tokens[tokens.length - 1];
  if (isModelCode(lastToken) && lastToken.length > MIN_TRIMMED_LENGTH) {
    for (let length = lastToken.length - 1; length >= MIN_TRIMMED_LENGTH; length--) {
      push([...tokens.slice(0, -1), lastToken.slice(0, length)].join(" "));
    }
  }

  for (let count = tokens.length - 1; count >= 1; count--) {
    push(tokens.slice(0, count).join(" "));
  }

  return variants.slice(0, MAX_VARIANTS);
}

/** Filter aktif di halaman pencarian, persis subset yang dipakai `/search`. */
export type SearchSuggestionFilters = Pick<
  GetProductsParams,
  "category" | "brand" | "minPrice" | "maxPrice" | "onSale"
>;

export type SearchSuggestion = {
  /** Kata kunci yang benar-benar menghasilkan produk ini — selalu ditampilkan. */
  keyword: string;
  /** `true` bila hasil ini baru muncul setelah filter aktif dilepas. */
  filtersDropped: boolean;
  products: Product[];
};

function hasActiveFilters(filters: SearchSuggestionFilters): boolean {
  return Object.values(filters).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return value;
    return value !== undefined && value !== null && value !== "";
  });
}

/**
 * Mengembalikan satu kumpulan saran, atau `null` kalau tidak ada satu pun
 * pelonggaran yang membuahkan hasil.
 *
 * Urutan percobaan disusun dari yang paling menghormati niat pelanggan:
 *   1. kata kunci dilonggarkan, filter yang ia pilih DIPERTAHANKAN;
 *   2. baru kalau tetap nihil, kata kunci aslinya dicoba tanpa filter;
 *   3. terakhir, kata kunci longgar tanpa filter.
 * Filter dilepas belakangan karena filter adalah pilihan sadar pelanggan,
 * sedangkan ejaan/kelengkapan kode model sering kali bukan.
 */
export async function getSearchSuggestions({
  query,
  filters = {},
  limit = 10,
}: {
  query: string;
  filters?: SearchSuggestionFilters;
  limit?: number;
}): Promise<SearchSuggestion | null> {
  const normalized = query.trim();
  if (!normalized) return null;

  const relaxed = buildRelaxedQueries(normalized);
  const filtersActive = hasActiveFilters(filters);

  const attempts: { keyword: string; filtersDropped: boolean }[] = [
    ...relaxed.map((keyword) => ({ keyword, filtersDropped: false })),
    ...(filtersActive
      ? [
          { keyword: normalized, filtersDropped: true },
          ...relaxed.map((keyword) => ({ keyword, filtersDropped: true })),
        ]
      : []),
  ].slice(0, MAX_ATTEMPTS);

  for (const attempt of attempts) {
    const { products } = await getProductsPaginated({
      ...(attempt.filtersDropped ? {} : filters),
      search: attempt.keyword,
      page: 1,
      perPage: limit,
    });

    if (products.length > 0) {
      return { keyword: attempt.keyword, filtersDropped: attempt.filtersDropped, products };
    }
  }

  return null;
}
