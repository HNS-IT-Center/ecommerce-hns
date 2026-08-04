/**
 * Helper banner yang MURNI — tanpa Prisma, tanpa akses database.
 *
 * Dipisahkan dari `lib/api/banners.ts` dengan sengaja: berkas itu mengimpor
 * `getPrisma`, dan begitu sebuah Client Component ikut mengimpor sesuatu
 * darinya, seluruh Prisma beserta driver MariaDB ikut terseret ke bundel
 * browser — build Turbopack langsung gagal. Semua yang dibutuhkan komponen
 * klien (pilihan warna & perhitungan status tayang) tinggal di sini.
 */

/** Pilihan warna latar. Kelasnya ditulis utuh supaya tidak dipangkas Tailwind. */
export const BANNER_BG_OPTIONS = [
  { value: "bg-primary", label: "Biru (Primary)" },
  { value: "bg-brand-green", label: "Hijau Brand" },
  { value: "bg-sale-red", label: "Merah Diskon" },
  { value: "bg-slate-900", label: "Hitam Slate" },
  { value: "bg-orange-600", label: "Oranye" },
  { value: "bg-violet-600", label: "Ungu" },
] as const

export type BannerLiveState = "live" | "scheduled" | "expired" | "inactive"

/**
 * Bentuk minimal yang dibutuhkan untuk menghitung status tayang.
 *
 * Sengaja struktural, bukan `PromoBanner` dari Prisma: fungsinya jadi bisa
 * dipakai di sisi klien tanpa menyeret tipe—dan paket—basis data.
 */
export type BannerSchedule = {
  isActive: boolean
  startsAt: Date | string | null
  endsAt: Date | string | null
}

export function bannerLiveState(banner: BannerSchedule, now = Date.now()): BannerLiveState {
  if (!banner.isActive) return "inactive"
  
  const startsAt = banner.startsAt ? new Date(banner.startsAt).getTime() : null
  if (startsAt && startsAt > now) return "scheduled"
  
  const endsAt = banner.endsAt ? new Date(banner.endsAt).getTime() : null
  if (endsAt && endsAt <= now) return "expired"
  
  return "live"
}
