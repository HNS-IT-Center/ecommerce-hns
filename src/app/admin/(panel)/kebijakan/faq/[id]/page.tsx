import { notFound } from "next/navigation"
import { getFaqItem } from "@/lib/api/policy"
import { FaqForm } from "../faq-form"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminFaqEditPage({ params }: Props) {
  const { id } = await params
  // Lihat catatan di halaman sunting toko — saringan `deletedAt` mencegah baris
  // yang sudah dihapus dibuka lalu dihidupkan lagi lewat Simpan.
  const item = await getFaqItem(id)

  if (!item) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Edit FAQ</h1>
      <div className="mt-6">
        <FaqForm item={item} />
      </div>
    </div>
  )
}
