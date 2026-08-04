import { notFound } from "next/navigation"

import { getBanner } from "@/lib/api/banners"
import { BannerForm } from "../banner-form"
import { updateBanner } from "../actions"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminBannerEditPage({ params }: Props) {
  const { id } = await params
  const banner = await getBanner(id)

  if (!banner) notFound()

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Edit Banner — {banner.title}</h1>
      <div className="mt-6">
        <BannerForm banner={banner} action={updateBanner} />
      </div>
    </div>
  )
}
