import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { CheckoutView } from "@/features/checkout/components/checkout-view"

export const metadata = {
  title: "Checkout — HNS IT Center",
  description: "Checkout belanja Anda di HNS IT Center",
}

export default function CheckoutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <CheckoutView />
        </div>
      </main>
      <Footer />
    </div>
  )
}
