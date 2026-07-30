import { notFound } from "next/navigation"
import { getStore } from "@/lib/api/stores"
import { StoreForm } from "../store-form"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminTokoEditPage({ params }: Props) {
  const { id } = await params
  // `getStore` menyaring `deletedAt`, jadi toko yang sudah dihapus tidak bisa
  // dibuka lewat URL langsung dan dihidupkan kembali dengan menekan Simpan.
  const store = await getStore(id)

  if (!store) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Edit Toko — {store.name}</h1>
      <div className="mt-6">
        <StoreForm store={store} />
      </div>
    </div>
  )
}
