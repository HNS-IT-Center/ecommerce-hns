import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"
import { VerifyBuildClient } from "./verify-build-client"

export const metadata = {
  title: "Cek Rincian Rakitan PC",
  description:
    "Masukkan kode quotation rakitan PC untuk melihat rincian harga per komponen.",
  // Halaman ini menampilkan data transaksi; jangan diindeks mesin pencari.
  robots: { index: false, follow: false },
}

export default function VerifyBuildPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <Breadcrumb
        items={[{ label: "Beranda", href: "/" }, { label: "Cek Rakitan PC" }]}
      />
      <main className="flex-1 bg-muted/20">
        <VerifyBuildClient />
      </main>
      <Footer />
    </div>
  )
}
