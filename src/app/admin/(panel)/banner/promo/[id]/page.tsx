import { notFound } from "next/navigation"
import { requirePageView } from "@/lib/auth"
import { getPromoForEdit } from "@/lib/api/promos"
import { PromoForm } from "../../promo-form"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminPromoEditPage({ params }: Props) {
  await requirePageView("banner")

  const { id } = await params
  const promo = await getPromoForEdit(id)
  if (!promo) notFound()

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Edit Promo — {promo.title}</h1>
      <div className="mt-6">
        <PromoForm promo={promo} />
      </div>
    </div>
  )
}
