import { notFound } from "next/navigation"

import { getBanner } from "@/lib/api/banners"
import { getBatchOptions } from "@/lib/api/banner-batches"
import { BannerForm } from "../banner-form"
import { updateBanner } from "../actions"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminBannerEditPage({ params }: Props) {
  const { id } = await params
  const [banner, batches] = await Promise.all([getBanner(id), getBatchOptions()])

  if (!banner) notFound()

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Edit Banner — {banner.title}</h1>
      <div className="mt-6">
        <BannerForm banner={banner} action={updateBanner} batches={batches} />
      </div>
    </div>
  )
}
