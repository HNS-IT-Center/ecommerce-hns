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
    title: "Customer Service",
    description: "Konsultasi via WhatsApp langsung",
    icon: Headset,
  },
]

export function TrustBar() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {trustItems.map((item, index) => (
          <div
            key={index}
            className="flex items-start sm:items-center gap-2.5 sm:gap-4 rounded-xl border border-border/50 bg-card p-2.5 sm:p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-8 w-8 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-sale-red/10 text-sale-red mt-0.5 sm:mt-0">
              <item.icon className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[10px] sm:text-sm font-bold text-foreground leading-tight truncate sm:whitespace-normal">
                {item.title}
              </h3>
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-none leading-tight">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
