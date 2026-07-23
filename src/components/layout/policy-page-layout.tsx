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
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <div className="prose prose-sm mt-6 max-w-none dark:prose-invert">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
