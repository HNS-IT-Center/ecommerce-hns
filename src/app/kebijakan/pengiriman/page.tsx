import { notFound } from "next/navigation"
import { PolicyPageLayout } from "@/components/layout/policy-page-layout"
import { getPolicyPage } from "@/lib/api/policy"

export const metadata = {
  title: "Kebijakan Pengiriman — HNS IT Center",
  description: "Area, estimasi waktu, dan opsi pengiriman/pengambilan barang di HNS IT Center.",
}

export default async function PengirimanPage() {
  const page = await getPolicyPage("pengiriman")
  if (!page) notFound()

  return (
    <PolicyPageLayout title={page.title} breadcrumbLabel="Pengiriman">
      <div dangerouslySetInnerHTML={{ __html: page.content }} />
    </PolicyPageLayout>
  )
}
