import Link from "next/link"
import { Search, Home, FileQuestion } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-6">
              <FileQuestion className="h-16 w-16 text-muted-foreground" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">404</h1>
            <h2 className="text-xl font-semibold text-foreground">Halaman Tidak Ditemukan</h2>
            <p className="text-sm text-muted-foreground">
              Maaf, halaman yang Anda cari mungkin telah dihapus, diubah namanya, atau tidak pernah ada.
            </p>
          </div>

          <div className="relative mx-auto mt-6">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Coba cari produk lain..."
              className="pl-9 h-10 w-full"
            />
          </div>

          <div className="pt-4">
            <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 w-full sm:w-auto">
              <Home className="mr-2 h-4 w-4" />
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
