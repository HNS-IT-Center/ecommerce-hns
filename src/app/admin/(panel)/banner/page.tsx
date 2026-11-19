import { getAllBanners } from "@/lib/api/banners"
import { getAllBatches } from "@/lib/api/banner-batches"
import { getAllPromos } from "@/lib/api/promos"
import { requirePageView } from "@/lib/auth"
import { BannerManager } from "./banner-manager"

type Props = {
  searchParams: Promise<{ tab?: string | string[] }>
}

export default async function AdminBannerPage({ searchParams }: Props) {
  await requirePageView("banner")
  const { tab } = await searchParams
  const [banners, batches, promos] = await Promise.all([
    getAllBanners(),
    getAllBatches(),
    getAllPromos(),
  ])

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Banner Promo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Slide yang tampil di bagian paling atas beranda, kampanye yang menaunginya, dan
          halaman promo yang dibuka saat banner diklik.
        </p>
      </div>

      <div className="mt-6">
        <BannerManager
          banners={banners}
          batches={batches}
          promos={promos}
          initialTab={typeof tab === "string" ? tab : undefined}
        />
      </div>
    </div>
  )
}
