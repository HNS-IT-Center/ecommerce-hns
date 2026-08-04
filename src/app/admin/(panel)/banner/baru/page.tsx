import { BannerForm } from "../banner-form"
import { createBanner } from "../actions"

export default function AdminBannerBaruPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Tambah Banner Promo</h1>
      <div className="mt-6">
        <BannerForm action={createBanner} />
      </div>
    </div>
  )
}
