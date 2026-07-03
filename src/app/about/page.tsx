import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Image from "next/image"
import { CheckCircle2, Star, MapPin } from "lucide-react"

export const metadata = {
  title: "Tentang Kami — HNS IT Center",
  description: "Kenali HNS IT Center, pusat IT terbesar dan terpercaya di Batam.",
}

const testimonials = [
  {
    name: "Riko Valdo",
    date: "25 Januari 2024",
    review: "Sangat recommended, abang nya di dukung proyektor, aduh ramah dan up-to-date soal barang IT...",
  },
  {
    name: "Muhammad Azka",
    date: "30 Januari 2024",
    review: "Bagus",
  },
  {
    name: "TAVIKURNIAWAN",
    date: "8 Februari 2024",
    review: "Sangat puas rakit pc di sini cepat teliti dan ramah semua abang-abang nya dan pelayanan sangat prima the best pokok nya",
  },
  {
    name: "Rendy Rusdiana",
    date: "14 Februari 2024",
    review: "Suka pelayanan di bidang langsung mantep respon cepet rakit pc nya the best dah pokoknya semua bisa...",
  },
]

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        
        {/* HERO SECTION */}
        <section className="container mx-auto px-4 py-12 md:px-6 md:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-muted-foreground uppercase tracking-wider">All about</h2>
                <h1 className="text-4xl font-extrabold tracking-tight text-sale-red sm:text-5xl lg:text-6xl mt-2">
                  HNS IT Center
                </h1>
                <h3 className="text-2xl font-bold mt-4">
                  #1 IT Center terbesar di Batam
                </h3>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  HNS IT Center adalah Toko yang berfokus pada penjualan 
                  PC Gaming, Laptop, Jaringan Komputer, dan Layanan Servis 
                  serta Upgrade untuk Instansi Pemerintah dan UKM. Kami 
                  Menawarkan berbagai brand ternama, komponen PC, Prosesor, 
                  Motherboard, RAM, dan Casing.
                </p>
                <p>
                  Di sini Anda juga dapat menemukan berbagai Laptop Primer, 
                  UPS, serta aksesoris lainnya dengan harga yang terjangkau.
                </p>
              </div>
              
              {/* Social Icons Placeholder */}
              <div className="flex gap-4 pt-2">
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-white hover:bg-black/80 transition-colors">
                  <span className="font-bold">TikTok</span>
                </a>
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-white hover:bg-black/80 transition-colors">
                  <span className="font-bold">IG</span>
                </a>
              </div>
            </div>

            {/* Right Image */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted shadow-lg">
              <div className="absolute inset-0 flex items-center justify-center bg-brand-green/5">
                {/* Placeholder since no real image is provided */}
                <div className="text-center">
                  <div className="text-6xl font-extrabold text-brand-green/20">HNS</div>
                  <p className="mt-2 font-bold text-muted-foreground">Nagoya Gateway Fasad</p>
                </div>
              </div>
              {/* Text overlay similar to image */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                <div className="absolute bottom-6 left-6 text-white">
                  <h3 className="text-2xl font-bold">HNS IT Center - Nagoya Gateway</h3>
                  <div className="mt-2 text-sm text-white/80 space-y-1">
                    <p>Jam Operasional</p>
                    <p>Senin-Sabtu: 09.00 - 21.00</p>
                    <p>Minggu: 10.00 - 21.00</p>
                  </div>
                  <button className="mt-4 rounded bg-[#0b57d0] px-4 py-2 text-sm font-semibold hover:bg-[#0b57d0]/90">
                    Cek Lokasi di Maps
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* OUR SERVICES */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-extrabold text-sale-red">Our Services</h2>
              
              {/* Service Tabs */}
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <button className="rounded-full bg-sale-red px-6 py-2.5 text-sm font-bold text-white shadow-md">
                  PC Gaming Rakitan
                </button>
                <button className="rounded-full bg-background border px-6 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">
                  Servis Komputer
                </button>
                <button className="rounded-full bg-background border px-6 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">
                  Pemasangan Jaringan & CCTV
                </button>
              </div>
              
              <div className="mt-8 max-w-4xl mx-auto space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  HNS IT Center, kami mengutamakan perakitan PC Gaming berkualitas premium. 
                  Tim profesional kami siap membantu Anda mendapatkan PC idaman dengan menggunakan komponen 
                  teruji dan terpercaya. Kami senantiasa membantu Anda memilih komponen yang optimal sesuai dengan 
                  anggaran dan preferensi Anda.
                </p>
                <p>
                  Setiap PC yang kami rakit diuji coba secara menyeluruh untuk memastikan kinerja 
                  dan keandalan yang maksimal. Jangan ragu, kami di sini merakit dan mewujudkan 
                  PC gaming impian Anda dengan pengalaman dan layanan terbaik!
                </p>
              </div>
            </div>

            {/* Photo Gallery Grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mt-12">
              <div className="col-span-2 row-span-2 aspect-square rounded-2xl bg-muted overflow-hidden">
                 <div className="flex h-full w-full items-center justify-center bg-brand-green/10 font-bold text-brand-green/40">Interior 1</div>
              </div>
              <div className="col-span-2 aspect-[2/1] rounded-2xl bg-muted overflow-hidden">
                 <div className="flex h-full w-full items-center justify-center bg-brand-green/10 font-bold text-brand-green/40">Interior 2</div>
              </div>
              <div className="col-span-1 aspect-square rounded-2xl bg-muted overflow-hidden">
                 <div className="flex h-full w-full items-center justify-center bg-brand-green/10 font-bold text-brand-green/40">Interior 3</div>
              </div>
              <div className="col-span-1 aspect-square rounded-2xl bg-muted overflow-hidden">
                 <div className="flex h-full w-full items-center justify-center bg-brand-green/10 font-bold text-brand-green/40">Interior 4</div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="container mx-auto px-4 py-16 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-sale-red md:text-4xl">
              Testimoni dari Pelanggan Kami!
            </h2>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-stretch">
            {/* Google Rating Summary */}
            <div className="flex shrink-0 flex-col items-center justify-center px-8 lg:border-r">
              <h3 className="text-xl font-bold">BAGUS SEKALI</h3>
              <div className="mt-2 flex gap-1 text-[#fbbc04]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 fill-current" />
                ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Berdasarkan 74 ulasan</p>
              <div className="mt-2 text-2xl font-bold text-[#4285f4]">Google</div>
            </div>

            {/* Testimonial Cards */}
            <div className="grid flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-xl border bg-card p-5 shadow-sm relative">
                  <div className="absolute top-4 right-4 text-[#4285f4]">
                     <span className="font-bold">G</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green/20 text-brand-green font-bold">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm line-clamp-1">{t.name}</h4>
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-0.5 text-[#fbbc04]">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-4">
                    {t.review}
                  </p>
                  <a href="#" className="mt-2 inline-block text-xs text-blue-600 hover:underline">Baca selengkapnya</a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* STORE LOCATIONS (BOTTOM) */}
        <section className="border-t bg-muted/10 py-16">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-sale-red">Alamat Main Store HNS IT Center</h3>
                <p className="text-muted-foreground mx-auto max-w-sm flex items-center justify-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-brand-green" />
                  Komplek Nagoya Gateway Blok E No.9, Kp. Seraya, Kec. Batu Ampar, Kota Batam
                </p>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-sale-red">Alamat Branch Store HNS IT Center</h3>
                <p className="text-muted-foreground mx-auto max-w-sm flex items-center justify-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-brand-green" />
                  Nagoya Hill Mall Lt. Dasar, Lubuk Baja Kota, Kec. Lubuk Baja, Kota Batam
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  )
}
