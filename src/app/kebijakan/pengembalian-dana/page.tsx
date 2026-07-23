import { notFound } from "next/navigation"
import { PolicyPageLayout } from "@/components/layout/policy-page-layout"
import { getPolicyPage } from "@/lib/api/policy"

export const metadata = {
  title: "Kebijakan Pengembalian Dana — HNS IT Center",
  description: "Syarat, metode, dan waktu proses pengembalian dana (refund) di HNS IT Center.",
}

export default async function PengembalianDanaPage() {
  const page = await getPolicyPage("pengembalian-dana")
  if (!page) notFound()

  return (
    <PolicyPageLayout title={page.title} breadcrumbLabel="Pengembalian Dana">
      <div dangerouslySetInnerHTML={{ __html: page.content }} />
    </PolicyPageLayout>
  )
}
