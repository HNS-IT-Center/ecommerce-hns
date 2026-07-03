import Link from "next/link"
import { Share2 } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-muted/20">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-4 lg:gap-12">
          
          {/* Col 1 */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-green text-primary-foreground font-bold">
                H
              </div>
              <span className="font-bold text-lg">HNS IT Center</span>
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
              <li><Link href="/careers" className="hover:text-foreground hover:underline">Karir</Link></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider">Bantuan</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/support" className="hover:text-foreground hover:underline">Klaim Garansi (SSO)</Link></li>
              <li><Link href="/support" className="hover:text-foreground hover:underline">Cek Ongkir Batam</Link></li>
              <li><Link href="/support" className="hover:text-foreground hover:underline">Kebijakan Retur</Link></li>
              <li><Link href="/support" className="hover:text-foreground hover:underline">Support Center</Link></li>
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
              <li>WA: 0811-7000-000</li>
              <li>cs@hnsitcenter.co.id</li>
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
