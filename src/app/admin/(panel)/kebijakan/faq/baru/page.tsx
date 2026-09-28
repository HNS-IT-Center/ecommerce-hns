import { requirePageView } from "@/lib/auth"
import { FaqForm } from "../faq-form"

export default async function AdminFaqBaruPage() {
  await requirePageView("kebijakan")

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Tambah FAQ</h1>
      <div className="mt-6">
        <FaqForm />
      </div>
    </div>
  )
}
