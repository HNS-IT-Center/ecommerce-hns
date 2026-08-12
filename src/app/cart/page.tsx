import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { CartView } from "@/features/cart/components/cart-view"

export const metadata = {
  title: "Keranjang Belanja — HNS IT Center",
  description: "Keranjang belanja Anda di HNS IT Center",
}

export default function CartPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <CartView />
        </div>
      </main>
      <Footer />
    </div>
  )
}
