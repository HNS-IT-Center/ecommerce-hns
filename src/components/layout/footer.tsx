import Link from "next/link"
import Image from "next/image"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { env } from "@/config/env"

export function Footer() {
  const waUrl = buildWhatsAppUrl(
    env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
    "Halo HNS IT Center, saya ingin bertanya."
  )

  return (
    <footer className="border-t bg-muted/20 print:hidden">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-4 lg:gap-12">
          
          {/* Col 1 */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center shrink-0">
              <Image 
                src="/images/Logo HNS IT Center.png" 
                alt="HNS IT Center Logo" 
                width={160} 
                height={40} 
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pusat IT & Gaming terpercaya di Batam. Harga terbaik, garansi resmi, teknisi berpengalaman.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="text-muted-foreground hover:text-foreground text-sm font-medium">
                Instagram
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground text-sm font-medium">
                Facebook
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground text-sm font-medium">
                Twitter
              </Link>
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider">Perusahaan</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground hover:underline">Tentang Kami</Link></li>
              <li><Link href="/stores" className="hover:text-foreground hover:underline">Toko Fisik</Link></li>
              <li><Link href="/contact" className="hover:text-foreground hover:underline">Kontak Kami</Link></li>
              <li><Link href="/blog" className="hover:text-foreground hover:underline">Blog</Link></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider">Bantuan</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/support" className="hover:text-foreground hover:underline">Pusat Bantuan & Klaim Garansi</Link></li>
              <li><Link href="/faq" className="hover:text-foreground hover:underline">FAQ</Link></li>
              <li><Link href="/kebijakan/pengembalian-barang" className="hover:text-foreground hover:underline">Kebijakan Pengembalian Barang</Link></li>
              <li><Link href="/kebijakan/pengembalian-dana" className="hover:text-foreground hover:underline">Kebijakan Pengembalian Dana</Link></li>
              <li><Link href="/kebijakan/pembatalan-pesanan" className="hover:text-foreground hover:underline">Kebijakan Pembatalan Pesanan</Link></li>
              <li><Link href="/kebijakan/pengiriman" className="hover:text-foreground hover:underline">Kebijakan Pengiriman</Link></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider">Metode Pembayaran</h4>
            <div className="flex gap-2 flex-wrap">
              <span className="rounded border bg-background px-2 py-1 text-xs font-medium">BCA</span>
              <span className="rounded border bg-background px-2 py-1 text-xs font-medium">Mandiri</span>
              <span className="rounded border bg-background px-2 py-1 text-xs font-medium">BRI</span>
              <span className="rounded border bg-background px-2 py-1 text-xs font-medium">BNI</span>
              <span className="rounded border bg-background px-2 py-1 text-xs font-medium">QRIS</span>
            </div>
            
            <h4 className="text-sm font-bold uppercase tracking-wider pt-4">Kontak</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                  WA: {env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER}
                </a>
              </li>
              <li>
                <a href="mailto:cs@hnsitcenter.co.id" className="hover:text-foreground hover:underline">
                  cs@hnsitcenter.co.id
                </a>
              </li>
            </ul>
          </div>
          
        </div>
        
        <div className="mt-12 border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© 2026 HNS IT Center. All rights reserved.</p>
          <p>Batam - Kepulauan Riau - Indonesia</p>
        </div>
      </div>
    </footer>
  )
}
