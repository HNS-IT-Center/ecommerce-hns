import { notFound } from "next/navigation"
import { PolicyPageLayout } from "@/components/layout/policy-page-layout"
import { getPolicyPage } from "@/lib/api/policy"

export const metadata = {
  title: "Kebijakan Pembatalan Pesanan — HNS IT Center",
  description: "Ketentuan pembatalan pesanan di HNS IT Center.",
}

export default async function PembatalanPesananPage() {
  const page = await getPolicyPage("pembatalan-pesanan")
  if (!page) notFound()

  return (
    <PolicyPageLayout title={page.title} breadcrumbLabel="Pembatalan Pesanan">
      <div dangerouslySetInnerHTML={{ __html: page.content }} />
    </PolicyPageLayout>
  )
}
