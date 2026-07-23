import { notFound } from "next/navigation"
import { getPrisma } from "@/lib/prisma/client"
import { StoreForm } from "../store-form"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminTokoEditPage({ params }: Props) {
  const { id } = await params
  const prisma = getPrisma()
  const store = await prisma.store.findUnique({ where: { id } })

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
