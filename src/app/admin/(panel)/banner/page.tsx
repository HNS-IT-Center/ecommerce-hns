import Link from "next/link"
import { Plus } from "lucide-react"

import { getAllBanners } from "@/lib/api/banners"
import { Button } from "@/components/ui/button"
import { BannerList } from "./banner-list"

export default async function AdminBannerPage() {
  const banners = await getAllBanners()

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Banner Promo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Slide yang tampil di bagian paling atas beranda.
          </p>
        </div>
        <Button render={<Link href="/admin/banner/baru" />} nativeButton={false}>
          <Plus className="h-4 w-4" />
          Tambah Banner
        </Button>
      </div>

      <div className="mt-6">
        <BannerList banners={banners} />
      </div>
    </div>
  )
}
