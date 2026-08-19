import Link from "next/link"
import { FileText } from "lucide-react"

import { PolicyPageLayout } from "@/components/layout/policy-page-layout"

export const metadata = {
  title: "Kebijakan — HNS IT Center",
  description:
    "Kebijakan pengembalian barang, pengembalian dana, pembatalan pesanan, dan pengiriman di HNS IT Center.",
}

/**
 * Halaman induk untuk /kebijakan/*.
 *
 * Sebelumnya alamat ini 404 padahal keempat anaknya ditaut dari footer setiap
 * halaman. Siapa pun yang memotong URL-nya — kebiasaan yang lazim — dan
 * crawler yang menelusuri naik sama-sama menabrak halaman kosong atas nama
 * domain HNS.
 *
 * Judulnya sengaja ditulis di sini, bukan diambil dari DB seperti isi tiap
 * kebijakan. Menariknya dari DB berarti empat query hanya untuk merender
 * daftar tautan, dan halaman anaknya sendiri sudah menulis `metadata.title`
 * secara literal — jadi ini mengikuti kebiasaan yang sudah ada, bukan
 * membuat pola baru.
 */
const KEBIJAKAN = [
  {
    slug: "pengembalian-barang",
    label: "Kebijakan Pengembalian Barang",
    ringkas: "Syarat, tenggat, dan kondisi barang yang bisa dikembalikan.",
  },
  {
    slug: "pengembalian-dana",
    label: "Kebijakan Pengembalian Dana",
    ringkas: "Cara dan lama proses pengembalian dana setelah pengajuan disetujui.",
  },
  {
    slug: "pembatalan-pesanan",
    label: "Kebijakan Pembatalan Pesanan",
    ringkas: "Sampai kapan pesanan bisa dibatalkan dan apa akibatnya.",
  },
  {
    slug: "pengiriman",
    label: "Kebijakan Pengiriman",
    ringkas: "Area layanan, estimasi waktu, dan pilihan ambil di toko.",
  },
] as const

export default function KebijakanIndexPage() {
  return (
    <PolicyPageLayout title="Kebijakan" breadcrumbLabel="Kebijakan">
      <p className="not-prose text-muted-foreground">
        Ketentuan yang berlaku untuk pembelian di HNS IT Center. Kalau ada yang belum terjawab di
        sini, hubungi kami lewat WhatsApp.
      </p>

      <ul className="not-prose mt-8 grid gap-3 sm:grid-cols-2">
        {KEBIJAKAN.map(({ slug, label, ringkas }) => (
          <li key={slug}>
            <Link
              href={`/kebijakan/${slug}`}
              className="flex h-full gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden="true" />
              <span>
                <span className="block font-bold text-foreground">{label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{ringkas}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PolicyPageLayout>
  )
}
