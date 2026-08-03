/**
 * Lapisan data untuk tabel `promo_banners`.
 *
 * Mengikuti konvensi modul toko & kategori: `revalidateTag`/`revalidatePath`
 * TIDAK dipanggil dari sini, melainkan dari lapisan action — supaya fungsi di
 * berkas ini tetap bisa dipakai dari script tanpa menyeret konteks request.
 */
import { unstable_cache } from "next/cache"
import { getPrisma } from "@/lib/prisma/client"
import type { PromoBanner, BannerDisplayMode } from "@prisma/client"
import { bannerLiveState } from "@/lib/utils/banner"

export const BANNERS_CACHE_TAG = "promo-banners"

export type BannerInput = {
  tag: string | null
  title: string
  subtitle: string | null
  ctaLabel: string | null
  ctaHref: string | null
  imageUrl: string | null
  bgClass: string
  displayMode: BannerDisplayMode
  sortOrder: number
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
 */
export async function getActiveBanners(): Promise<PromoBanner[]> {
  const fetcher = unstable_cache(
    async () =>
      getPrisma().promoBanner.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    ["active-promo-banners"],
    { revalidate: 300, tags: [BANNERS_CACHE_TAG] }
  )

  const banners = await fetcher()
  const now = Date.now()
  return banners.filter((banner) => bannerLiveState(banner, now) === "live")
}

/** Semua banner termasuk yang nonaktif & di luar jadwal — untuk panel admin. */
export async function getAllBanners(): Promise<PromoBanner[]> {
  return getPrisma().promoBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
}

export async function getBanner(id: string): Promise<PromoBanner | null> {
  return getPrisma().promoBanner.findUnique({ where: { id } })
}

export async function createBanner(input: BannerInput): Promise<void> {
  await getPrisma().promoBanner.create({ data: input })
}

export async function updateBanner(id: string, input: BannerInput): Promise<void> {
  await getPrisma().promoBanner.update({ where: { id }, data: input })
}

export async function deleteBanner(id: string): Promise<void> {
  await getPrisma().promoBanner.delete({ where: { id } })
}
