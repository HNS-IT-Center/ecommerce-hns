import { notFound } from "next/navigation"
import { PolicyPageLayout } from "@/components/layout/policy-page-layout"
import { getPolicyPage } from "@/lib/api/policy"

export const metadata = {
  title: "Kebijakan Pengembalian Barang — HNS IT Center",
  description: "Syarat dan ketentuan pengembalian barang di HNS IT Center.",
}

export default async function PengembalianBarangPage() {
  const page = await getPolicyPage("pengembalian-barang")
  if (!page) notFound()

  return (
    <PolicyPageLayout title={page.title} breadcrumbLabel="Pengembalian Barang">
      <div dangerouslySetInnerHTML={{ __html: page.content }} />
    </PolicyPageLayout>
  )
}
