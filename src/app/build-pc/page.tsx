import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { BuilderView } from "@/features/builder/components/builder-view"
import { env } from "@/config/env"

export const metadata = {
  title: "PC Builder Custom — HNS IT Center",
  description: "Rakit PC idaman Anda dengan mudah. Pilih komponen, cek estimasi harga, dan cetak hasilnya.",
}

export default function BuildPcPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="print:hidden">
        <Header />
      </div>
      <main className="flex-1 bg-muted/20 print:bg-white print:m-0 print:p-0">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 print:max-w-none print:p-8">
          <BuilderView whatsappNumber={env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER} />
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
