/**
 * Helper halaman promo yang MURNI — tanpa Prisma, tanpa akses database.
 *
 * Alasannya sama dengan `lib/utils/banner.ts`: komponen klien (hitung mundur,
 * formulir admin) membutuhkan aturan ini, dan mengimpornya dari
 * `lib/api/promos.ts` akan menyeret Prisma ke bundel browser.
 */
import { bannerLiveState } from "@/lib/utils/banner"

/** Status halaman promo yang dilihat pengunjung. */
export type PromoPhase = "upcoming" | "live" | "ended"

export type PromoSchedule = {
  startsAt: Date | string | null
  endsAt: Date | string | null
}

/**
 * Status jadwal promo. Memakai `bannerLiveState` supaya batas mulai/berakhir
 * dihitung dengan aturan yang SAMA dengan banner yang menautnya — kalau
 * berbeda, banner bisa masih tayang sementara halamannya sudah "berakhir".
 *
 * `isActive` tidak ikut di sini: promo nonaktif tidak punya halaman sama sekali
 * (404), jadi ia bukan salah satu status yang perlu digambar.
 */
export function promoPhase(promo: PromoSchedule, now = Date.now()): PromoPhase {
  const state = bannerLiveState({ isActive: true, ...promo }, now)
  if (state === "scheduled") return "upcoming"
  if (state === "expired") return "ended"
  return "live"
}

export function promoHref(slug: string): string {
  return `/promo/${slug}`
}

/** Pola slug yang diterima — sama dengan yang dihasilkan `slugifyPromo`. */
export const PROMO_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Judul → slug, mis. "September Laptop Sale!" → "september-laptop-sale". */
export function slugifyPromo(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
    .replace(/-+$/g, "")
}

/** Syarat & ketentuan disimpan sebagai teks, satu butir per baris. */
export function parsePromoTerms(terms: string | null | undefined): string[] {
  if (!terms) return []
  return terms
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean)
}

const DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
})

const TIME_FORMAT = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/**
 * Tanggal & jam promo dalam WIB, dibaca server dan klien dengan hasil yang
 * sama — zona waktunya dipatok, bukan mengikuti perangkat pengunjung, supaya
 * HTML server dan hidrasi klien tidak berselisih.
 */
export function formatPromoDate(value: Date | string): { date: string; time: string } {
  const date = new Date(value)
  return {
    date: DATE_FORMAT.format(date),
    time: TIME_FORMAT.format(date).replace(".", ":"),
  }
}
