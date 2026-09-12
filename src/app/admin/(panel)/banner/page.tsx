import { getAllBanners } from "@/lib/api/banners"
import { getAllBatches } from "@/lib/api/banner-batches"
import { requirePageView } from "@/lib/auth"
import { BannerManager } from "./banner-manager"

export default async function AdminBannerPage() {
  await requirePageView("banner")
  const [banners, batches] = await Promise.all([getAllBanners(), getAllBatches()])

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Banner Promo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Slide yang tampil di bagian paling atas beranda, beserta kampanye yang menaunginya.
        </p>
      </div>

      <div className="mt-6">
        <BannerManager banners={banners} batches={batches} />
      </div>
    </div>
  )
}
