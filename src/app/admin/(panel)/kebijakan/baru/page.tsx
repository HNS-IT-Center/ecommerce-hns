import { requirePageView } from "@/lib/auth"
import { PolicyPageForm } from "../policy-page-form"

// Layout panel hanya memastikan ada yang login. Penjaga per-halaman ada di sini
// supaya staff yang izin "Kebijakan"-nya disetel `none` tidak bisa membuka
// formulir ini lewat alamatnya langsung.
export default async function AdminKebijakanBaruPage() {
  await requirePageView("kebijakan")

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Tambah Kebijakan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Halaman baru langsung tayang di <code>/kebijakan</code> setelah disimpan.
      </p>
      <div className="mt-6">
        <PolicyPageForm />
      </div>
    </div>
  )
}
