import { AlertTriangle } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"

interface PolicyPageLayoutProps {
  title: string
  breadcrumbLabel: string
  children: React.ReactNode
}

export function PolicyPageLayout({ title, breadcrumbLabel, children }: PolicyPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: breadcrumbLabel }]} />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              <strong>DRAFT — belum direview.</strong> Konten di halaman ini disusun
              berdasarkan konteks bisnis umum HNS IT Center dan belum dikonfirmasi oleh
              pemilik toko. Jangan jadikan acuan resmi sebelum ditinjau.
            </p>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <div className="prose prose-sm mt-6 max-w-none dark:prose-invert">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
