import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SupportTicketForm } from "@/features/support/components/support-ticket-form"

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center py-20 bg-muted/20">
        <div className="container mx-auto px-4 max-w-3xl">
          <SupportTicketForm />
        </div>
      </main>
      <Footer />
    </div>
  )
}
