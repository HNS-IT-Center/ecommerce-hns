import { notFound } from "next/navigation"
import { requirePageView } from "@/lib/auth"
import { getAdminPolicyPage } from "@/lib/api/policy"
import { PolicyPageForm } from "../policy-page-form"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function AdminKebijakanEditPage({ params }: Props) {
  await requirePageView("kebijakan")
  const { slug } = await params

  /*
   * Dari database, bukan lagi dari konstanta `POLICY_PAGES`.
   *
   * Versi lama menolak (404) setiap slug yang tidak ada di konstanta, jadi
   * kebijakan yang dibuat staff sendiri tidak bisa dibuka untuk disunting.
   *
   * Saringan `deletedAt` ada di `getAdminPolicyPage` — lihat catatan di halaman
   * sunting toko: tanpa itu, baris yang sudah dihapus bisa dibuka lalu
   * dihidupkan kembali lewat Simpan.
   */
  const page = await getAdminPolicyPage(slug)
  if (!page) notFound()

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Edit — {page.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">/kebijakan/{page.slug}</p>
      <div className="mt-6">
        <PolicyPageForm
          page={{
            slug: page.slug,
            title: page.title,
            description: page.description ?? "",
            content: page.content,
            sortOrder: page.sortOrder,
          }}
        />
      </div>
    </div>
  )
}
