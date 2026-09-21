import Link from "next/link"
import { FileText } from "lucide-react"

import { PolicyPageLayout } from "@/components/layout/policy-page-layout"
import { getPolicyPages } from "@/lib/api/policy"

export const metadata = {
  title: "Kebijakan",
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
 * Daftarnya sekarang dari database, bukan lagi array di berkas ini. Sejak
 * kebijakan bisa ditambah staff lewat /admin/kebijakan, daftar yang ditulis di
 * kode berarti halaman baru tayang di alamatnya sendiri tapi tidak pernah
 * muncul di sini — ada, tapi tidak bisa ditemukan.
 *
 * `metadata.description` di atas tetap ditulis harfiah: ia menyebut keempat
 * kebijakan bawaan, dan menyusunnya dari data berarti satu query lagi hanya
 * untuk merangkai kalimat yang akan makin panjang tiap kali staff menambah
 * halaman.
 */
export default async function KebijakanIndexPage() {
  const kebijakan = await getPolicyPages()

  return (
    <PolicyPageLayout title="Kebijakan" breadcrumbLabel="Kebijakan">
      <p className="not-prose text-muted-foreground">
        Ketentuan yang berlaku untuk pembelian di HNS IT Center. Kalau ada yang belum terjawab di
        sini, hubungi kami lewat WhatsApp.
      </p>

      <ul className="not-prose mt-8 grid gap-3 sm:grid-cols-2">
        {kebijakan.map(({ slug, title, description }) => (
          <li key={slug}>
            <Link
              href={`/kebijakan/${slug}`}
              className="flex h-full gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden="true" />
              <span>
                <span className="block font-bold text-foreground">{title}</span>
                {/*
                  Kartu tanpa ringkasan tetap tampil rapi — kebijakan yang
                  dibuat staff boleh saja belum punya ringkasan, dan itu bukan
                  alasan untuk menyisakan baris kosong di bawah judulnya.
                */}
                {description && (
                  <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PolicyPageLayout>
  )
}
