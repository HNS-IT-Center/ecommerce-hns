import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PolicyPageLayout } from "@/components/layout/policy-page-layout"
import { getPolicyPage } from "@/lib/api/policy"
import { policyBreadcrumbLabel } from "@/lib/utils/policy-label"

/**
 * Satu route untuk SEMUA halaman kebijakan.
 *
 * Sebelumnya tiap kebijakan punya foldernya sendiri dengan `metadata` yang
 * ditulis harfiah, sehingga menambah kebijakan baru mustahil dilakukan staff —
 * ia butuh folder baru, dan folder baru butuh deploy. Isinya sendiri sudah
 * lama datang dari database; yang tertinggal di kode cuma daftar alamatnya.
 *
 * Alamat keempat kebijakan lama tidak berubah sedikit pun. Itu disengaja:
 * ketiganya saling menaut di dalam isi kebijakan, `/kebijakan/pengiriman`
 * ditaut dari halaman produk, dan keempatnya sudah terindeks mesin pencari.
 *
 * Tidak ada `generateStaticParams`: layout root memakai `force-dynamic`
 * (lihat catatan di sana), jadi tiap permintaan dirender ulang dan daftar
 * parameter statis hanya akan menyesatkan pembaca berikutnya.
 */

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPolicyPage(slug)

  // Halaman yang tidak ada akan dijawab `notFound()` di bawah. Judul di sini
  // hanya menutupi jeda sebelum itu terjadi.
  if (!page) return { title: "Kebijakan Tidak Ditemukan" }

  return {
    title: page.title,
    // Kebijakan yang dibuat staff tanpa ringkasan tidak mendapat meta
    // description karangan — lebih baik tidak ada daripada salah.
    ...(page.description ? { description: page.description } : {}),
  }
}

export default async function KebijakanDetailPage({ params }: Props) {
  const { slug } = await params
  const page = await getPolicyPage(slug)
  if (!page) notFound()

  return (
    <PolicyPageLayout title={page.title} breadcrumbLabel={policyBreadcrumbLabel(page.title)}>
      <div dangerouslySetInnerHTML={{ __html: page.content }} />
    </PolicyPageLayout>
  )
}
