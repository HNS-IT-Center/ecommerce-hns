import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { AccountView } from "@/features/auth/components/account-view"

export default function AccountPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-muted/20 py-12">
        <AccountView />
      </main>
      <Footer />
    </div>
  )
}
