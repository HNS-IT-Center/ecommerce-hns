/**
 * Lapisan data untuk tabel `promo_banners`.
 *
 * Mengikuti konvensi modul toko & kategori: `revalidateTag`/`revalidatePath`
 * TIDAK dipanggil dari sini, melainkan dari lapisan action — supaya fungsi di
 * berkas ini tetap bisa dipakai dari script tanpa menyeret konteks request.
 */
import { unstable_cache } from "next/cache"
import { getPrisma } from "@/lib/prisma/client"
import type { PromoBanner, BannerBatch, BannerDisplayMode } from "@prisma/client"
import { activeBatchGate, effectiveBannerState, sortBannersForDisplay } from "@/lib/utils/banner"

export const BANNERS_CACHE_TAG = "promo-banners"

/** Banner beserta kampanye penaungnya — `null` kalau ia berdiri sendiri. */
export type BannerWithBatch = PromoBanner & { batch: BannerBatch | null }

export type BannerInput = {
  tag: string | null
  title: string
  subtitle: string | null
  ctaLabel: string | null
  ctaHref: string | null
  imageUrl: string | null
  bgClass: string
  displayMode: BannerDisplayMode
  batchId: string | null
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
}

/**
 * Banner yang layak tampil di beranda saat ini.
 *
 * Penyaringan jadwal sengaja dilakukan DI LUAR `unstable_cache`. Kalau ikut
 * masuk ke dalamnya, "sekarang" yang dipakai adalah saat entri cache dibuat —
 * promo yang dijadwalkan mulai pukul 00.00 baru muncul setelah cache beranda
 * kedaluwarsa, dan yang sudah berakhir masih terpampang. Jumlah barisnya
 * sedikit, jadi menyaring ulang tiap permintaan praktis tanpa biaya.
 *
 * Kampanye penaung ikut disaring di sini dan dengan alasan yang sama: jadwal
 * batch pun dihitung saat dibaca, tidak ditegakkan cron.
 */
export async function getActiveBanners(): Promise<PromoBanner[]> {
  const fetcher = unstable_cache(
    async () =>
      getPrisma().promoBanner.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { batch: true },
      }),
    ["active-promo-banners"],
    { revalidate: 300, tags: [BANNERS_CACHE_TAG] }
  )

  const banners = await fetcher()
  const now = Date.now()
  const live = banners.filter(
    (banner) => effectiveBannerState(banner, activeBatchGate(banner.batch), now).state === "live"
  )

  // Urutan akhirnya bukan `sortOrder` mentah: banner milik kampanye yang
  // sedang tayang naik ke depan sebagai satu blok. Aturannya di
  // lib/utils/banner, dipakai bersama daftar admin.
  return sortBannersForDisplay(live, now)
}

/** Semua banner termasuk yang nonaktif & di luar jadwal — untuk panel admin. */
export async function getAllBanners(): Promise<BannerWithBatch[]> {
  return getPrisma().promoBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { batch: true },
  })
}

export async function getBanner(id: string): Promise<PromoBanner | null> {
  return getPrisma().promoBanner.findUnique({ where: { id } })
}

/**
 * Banner baru selalu masuk ke urutan PALING BAWAH.
 *
 * `sortOrder` tidak lagi bisa diketik di formulir — satu-satunya penulisnya
 * adalah `reorderBanners`. Nilai awal di sini cuma menentukan di mana barisnya
 * muncul pertama kali; menaruhnya di angka 0 akan menyelinapkan banner yang
 * belum sempat ditata ke puncak beranda.
 */
export async function createBanner(input: BannerInput): Promise<void> {
  const last = await getPrisma().promoBanner.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })

  await getPrisma().promoBanner.create({
    data: { ...input, sortOrder: (last?.sortOrder ?? -1) + 1 },
  })
}

/** `sortOrder` sengaja TIDAK ikut di sini — lihat `reorderBanners`. */
export async function updateBanner(id: string, input: BannerInput): Promise<void> {
  await getPrisma().promoBanner.update({ where: { id }, data: input })
}

/**
 * Menulis ulang SELURUH `sortOrder` menjadi 0..n-1 mengikuti urutan `ids`.
 *
 * Satu-satunya penulis kolom itu. Formulir banner tidak lagi punya kolom
 * isian urutan: daftar seret dan kotak angka adalah dua sumber kebenaran untuk
 * hal yang sama, dan yang satu akan menimpa yang lain tanpa diketahui staff.
 *
 * Ditulis dalam satu transaksi supaya tidak pernah ada keadaan setengah jadi —
 * urutan yang separuh lama separuh baru berarti dua banner berbagi nomor, dan
 * beranda memilih salah satunya secara sembarang.
 *
 * `ids` adalah seluruh banner, bukan hanya yang sedang tayang. Menulis ulang
 * sebagian akan membuat nomor yang tersisa bertabrakan dengan yang baru.
 */
export async function reorderBanners(ids: string[]): Promise<void> {
  const prisma = getPrisma()
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.promoBanner.update({ where: { id }, data: { sortOrder: index } })
    )
  )
}

export async function deleteBanner(id: string): Promise<void> {
  await getPrisma().promoBanner.delete({ where: { id } })
}
