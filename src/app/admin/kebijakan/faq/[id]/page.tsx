import { notFound } from "next/navigation"
import { getPrisma } from "@/lib/prisma/client"
import { FaqForm } from "../faq-form"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminFaqEditPage({ params }: Props) {
  const { id } = await params
  const prisma = getPrisma()
  const item = await prisma.faqItem.findUnique({ where: { id } })

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
