import { requirePageView } from "@/lib/auth"
import { AdminBackLink } from "@/components/admin/admin-back-link"
import { getBatchOptions } from "@/lib/api/banner-batches"
import { getPromoOptions } from "@/lib/api/promos"
import { BannerForm } from "../banner-form"
import { createBanner } from "../actions"

export default async function AdminBannerBaruPage() {
  await requirePageView("banner")

  const [batches, promos] = await Promise.all([getBatchOptions(), getPromoOptions()])

  return (
    <div className="mx-auto max-w-6xl">
      <AdminBackLink href="/admin/banner">Kembali ke daftar banner</AdminBackLink>
      <h1 className="text-2xl font-bold">Tambah Banner Promo</h1>
      <div className="mt-6">
        <BannerForm action={createBanner} batches={batches} promos={promos} />
      </div>
    </div>
  )
}
