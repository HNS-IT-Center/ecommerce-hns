import { notFound } from "next/navigation"
import { getPrisma } from "@/lib/prisma/client"
import { POLICY_PAGES } from "@/lib/constants/policy-content"
import { PolicyPageForm } from "./policy-page-form"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function AdminKebijakanEditPage({ params }: Props) {
  const { slug } = await params
  const fallback = POLICY_PAGES.find((page) => page.slug === slug)
  if (!fallback) notFound()

  const prisma = getPrisma()
  const page = await prisma.policyPage.findUnique({ where: { slug } })

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Edit — {page?.title ?? fallback.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">/kebijakan/{slug}</p>
      <div className="mt-6">
        <PolicyPageForm
          slug={slug}
          title={page?.title ?? fallback.title}
          content={page?.content ?? fallback.content}
        />
      </div>
    </div>
  )
}
