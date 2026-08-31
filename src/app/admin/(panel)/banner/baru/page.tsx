import { getBatchOptions } from "@/lib/api/banner-batches"
import { BannerForm } from "../banner-form"
import { createBanner } from "../actions"

export default async function AdminBannerBaruPage() {
  const batches = await getBatchOptions()

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Tambah Banner Promo</h1>
      <div className="mt-6">
        <BannerForm action={createBanner} batches={batches} />
      </div>
    </div>
  )
}
