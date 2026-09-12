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

/**
 * Status tayang setelah gerbang kampanye ikut diperhitungkan.
 *
 * `heldByBatch` memisahkan dua sebab yang tampak sama di daftar admin: banner
 * yang memang dimatikan/di luar jadwalnya sendiri, dan banner yang setelannya
 * sudah benar tapi ditahan kampanye induknya. Tanpa pembedaan itu staff akan
 * membetulkan banner yang tidak salah apa-apa.
 */
export type EffectiveBannerState = {
  state: BannerLiveState
  heldByBatch: boolean
}

/**
 * Banner baru tayang kalau DUA-DUANYA sedang tayang — dirinya sendiri dan
 * kampanye penaungnya. Itu janji yang ditulis di `BannerBatch.isActive`
 * (prisma/schema.prisma): batch adalah gerbang induk, bukan sekadar label.
 *
 * `batch` boleh null — banner tanpa kampanye berdiri sendiri, begitu pula
 * banner yang kampanyenya sudah dihapus (lihat `softDeleteBatch`).
 */
export function effectiveBannerState(
  banner: BannerSchedule,
  batch: BannerSchedule | null,
  now = Date.now()
): EffectiveBannerState {
  const own = bannerLiveState(banner, now)
  if (own !== "live") return { state: own, heldByBatch: false }

  if (!batch) return { state: "live", heldByBatch: false }

  const parent = bannerLiveState(batch, now)
  if (parent !== "live") return { state: parent, heldByBatch: true }

  return { state: "live", heldByBatch: false }
}

/**
 * Tanggal untuk `<input type="date">`, dibaca dalam zona waktu setempat.
 *
 * JANGAN memakai `toISOString().split("T")[0]` di sini. Tanggal mulai disimpan
 * sebagai awal hari waktu setempat (00:00), yang di WIB berarti pukul 17:00 UTC
 * pada tanggal SEBELUMNYA — sehingga membuka halaman sunting akan menampilkan
 * tanggal mulai mundur satu hari, dan menyimpannya kembali menggeser jadwalnya
 * satu hari lagi setiap kali disunting.
 *
 * Dipakai bersama oleh formulir banner dan formulir kampanye: aturan sehalus
 * ini tidak boleh hidup dalam dua salinan yang bisa berbeda diam-diam.
 */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Kampanye yang masih berlaku sebagai gerbang tayang.
 *
 * Kampanye yang sudah di-soft-delete tidak lagi menahan anggotanya — ia
 * tinggal label arsip (lihat `softDeleteBatch` di lib/api/banner-batches).
 * Tanpa penyaringan ini, kampanye yang sudah dibuang dari panel admin masih
 * diam-diam mematikan banner, dan tidak ada layar mana pun yang bisa
 * menjelaskan kenapa.
 *
 * Tinggal di berkas murni ini supaya beranda (`getActiveBanners`) dan lencana
 * di panel admin (`banner-list.tsx`) memakai aturan yang SAMA — bukan dua
 * salinan yang bisa berbeda diam-diam.
 */
export function activeBatchGate<T extends { deletedAt: Date | string | null }>(
  batch: T | null | undefined
): T | null {
  if (!batch || batch.deletedAt) return null
  return batch
}

/** Bentuk minimal untuk mengurutkan: nomor urut + kampanye penaungnya. */
export type BannerOrderable = {
  sortOrder: number
  batch: (BannerSchedule & { deletedAt: Date | string | null }) | null
}

/**
 * Banner milik kampanye yang SEDANG TAYANG selalu berada di depan.
 *
 * Kampanye adalah promo yang sedang berjalan — kalau ia punya enam banner,
 * keenamnya yang pertama dilihat pengunjung, baru sisanya. Kampanye yang
 * belum mulai, sudah berakhir, dimatikan, atau sudah dihapus TIDAK mengunci
 * apa pun: banner anggotanya ikut antre seperti banner biasa.
 */
export function isPinnedByBatch(banner: BannerOrderable, now = Date.now()): boolean {
  const gate = activeBatchGate(banner.batch)
  return gate !== null && bannerLiveState(gate, now) === "live"
}

/**
 * Urutan tampil: blok kampanye dulu, lalu sisanya; di dalam masing-masing
 * blok mengikuti `sortOrder` yang disusun staff lewat seret di panel admin.
 *
 * Dipakai beranda (`getActiveBanners`) DAN daftar admin. Kalau dua tempat itu
 * memakai aturan yang berbeda, staff menyusun urutan yang tidak pernah benar-
 * benar dilihat pengunjung — dan tidak ada layar yang bisa menjelaskan
 * selisihnya.
 */
export function sortBannersForDisplay<T extends BannerOrderable>(
  banners: T[],
  now = Date.now()
): T[] {
  return [...banners].sort((a, b) => {
    const pinnedA = isPinnedByBatch(a, now)
    const pinnedB = isPinnedByBatch(b, now)
    if (pinnedA !== pinnedB) return pinnedA ? -1 : 1
    return a.sortOrder - b.sortOrder
  })
}
