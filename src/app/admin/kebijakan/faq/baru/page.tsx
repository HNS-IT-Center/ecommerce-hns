import { FaqForm } from "../faq-form"

export default function AdminFaqBaruPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Tambah FAQ</h1>
      <div className="mt-6">
        <FaqForm />
      </div>
    </div>
  )
}
