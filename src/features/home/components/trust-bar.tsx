import { Tags, Wrench, Truck, Headset } from "lucide-react"

const trustItems = [
  {
    title: "Harga Terbaik",
    description: "Jaminan harga bersaing di Batam",
    icon: Tags,
  },
  {
    title: "Teknisi Berpengalaman",
    description: "Layanan rakit & service in-house",
    icon: Wrench,
  },
  {
    title: "Gratis Pengiriman",
    description: "Area Batam untuk pembelian tertentu",
    icon: Truck,
  },
  {
    title: "CS 7 Hari",
    description: "Konsultasi via WhatsApp langsung",
    icon: Headset,
  },
]

export function TrustBar() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {trustItems.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sale-red/10 text-sale-red">
              <item.icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-tight">
                {item.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
