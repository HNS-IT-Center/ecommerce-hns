import { requirePageView } from "@/lib/auth"
import { AdminBackLink } from "@/components/admin/admin-back-link"
import { FaqForm } from "../faq-form"

export default async function AdminFaqBaruPage() {
  await requirePageView("kebijakan")

  return (
    <div className="mx-auto max-w-3xl">
      <AdminBackLink href="/admin/kebijakan">Kembali ke daftar FAQ</AdminBackLink>
      <h1 className="text-2xl font-bold">Tambah FAQ</h1>
      <div className="mt-6">
        <FaqForm />
      </div>
    </div>
  )
}
