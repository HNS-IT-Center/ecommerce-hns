import { MapPin } from "lucide-react"

const stores = [
  {
    id: "nagoya-gateway",
    name: "HNS Nagoya Gateway",
    address: "Nagoya Gateway Lt. 2 Blok A2, Batam",
    hours: "10:00 - 21:00 WIB",
    mapsUrl: "#",
    waUrl: "#",
    bgClass: "bg-orange-200/50",
  },
  {
    id: "nagoya-hill",
    name: "HNS Nagoya Hill",
    address: "Nagoya Hill Mall Lt. GF Blok G-15, Batam",
    hours: "10:30 - 22:00 WIB",
    mapsUrl: "#",
    waUrl: "#",
    bgClass: "bg-blue-200/50",
  },
]

export function StoreLocations() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12 mb-12">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Toko Fisik Kami
        </h2>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Kunjungi langsung untuk demo produk & konsultasi.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stores.map((store) => (
          <div key={store.id} className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card hover:shadow-md transition-shadow">
            {/* Map Placeholder Image Area */}
            <div className={`relative h-48 w-full ${store.bgClass} flex items-center justify-center`}>
              <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] transition-all group-hover:backdrop-blur-0" />
              <MapPin className="relative z-10 h-10 w-10 text-primary opacity-50 transition-transform group-hover:scale-110 group-hover:opacity-100" />
            </div>
            
            {/* Store Details */}
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-lg font-bold text-foreground">
                {store.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {store.address}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                Buka: {store.hours}
              </p>
              
              <div className="mt-6 flex items-center gap-3">
                <a href={store.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                  Lihat Peta
                </a>
                <a href={store.waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center justify-center rounded-md bg-brand-green px-3 text-xs font-medium text-white shadow transition-colors hover:bg-brand-green/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                  Chat WA
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
