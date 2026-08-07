import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { DynamicBuilderView } from "@/features/builder/components/dynamic-builder-view"
import { getPcBuilderConfig } from "@/app/admin/(panel)/pc-builder/actions"

export const metadata = {
  title: "PC Builder Custom — HNS IT Center",
  description: "Rakit PC idaman Anda dengan mudah. Pilih komponen, cek estimasi harga, dan cetak hasilnya.",
}

export default async function BuildPcPage() {
  const stepsConfig = await getPcBuilderConfig()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="hidden md:block print:hidden">
        <Header />
      </div>
      <main className="flex-1 bg-muted/20 print:bg-white print:m-0 print:p-0">
        <div className="mx-auto px-4 py-8 md:px-6 md:py-12 print:max-w-none print:p-8">
          <DynamicBuilderView stepsConfig={stepsConfig} />
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
