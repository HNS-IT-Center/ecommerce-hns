import Link from "next/link"
import Image from "next/image"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { env } from "@/config/env"
import { getThemeSettings } from "@/lib/theme/settings"
import { ChristmasFooterDecor, ChristmasFooterPattern } from "@/components/theme/christmas-decor"

export async function Footer() {
  const waUrl = buildWhatsAppUrl(
    env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
    "Halo HNS IT Center, saya ingin bertanya."
  )

  const theme = await getThemeSettings()
  const isChristmas = theme.activeChromeThemeId === "christmas"

  // Navy diambil dari `--primary-800` (#0d2959) — nada yang sama dengan
  // sidebar admin, jadi panel staff dan situs pelanggan sewarna.
  //
  // Ditulis sebagai `var(--footer-bg, …)` dengan fallback, BUKAN warna mati.
  // Footer ini ber-scope `theme-chrome`, titik cantol Theme Editor; kalau
  // navy-nya di-hardcode, tema musiman (mis. Natal) berhenti bisa mengubah
  // footer dan situs jadi tampak setengah bertema — header dan dock ikut
  // berubah, footer tidak. Fallback-nya yang menyalakan navy selama tidak ada
  // tema aktif.
  return (
    <footer
      className="theme-chrome relative border-t border-white/15 bg-[var(--footer-bg,#0d2959)] text-[var(--footer-fg,#ffffff)] print:hidden"
    >
      {isChristmas && <ChristmasFooterPattern />}
      {isChristmas && <ChristmasFooterDecor />}
      {/* `relative z-10` menaikkan isi footer ke atas lapisan pola di
          belakangnya — tanpa ini teksnya tetap terbaca, tapi berada di lapisan
          yang sama dan urutannya bergantung pada urutan DOM saja. */}
      <div className="container relative z-10 mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-4 lg:gap-12">
          
          {/* Col 1 */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center shrink-0">
              {/* Logo dijadikan putih penuh KHUSUS di footer.
                  Logo aslinya merah + biru tua. Merahnya masih terbaca di atas
                  navy, tapi teks birunya ("#1 IT CENTER BATAM" dan baris
                  layanan) hampir sewarna dengan latarnya dan praktis hilang.

                  `brightness(0)` menjadikan semua piksel hitam, `invert(1)`
                  membalikkannya jadi putih — alpha PNG tidak ikut terpengaruh,
                  jadi bentuk logonya tetap utuh tanpa kotak latar.

                  Konsekuensi yang disengaja: merah HNS ikut menjadi putih.
                  Filter CSS berlaku ke seluruh piksel, tidak bisa memilih satu
                  warna saja, jadi pilihannya memang antara logo satu warna yang
                  terbaca penuh atau logo dua warna yang separuhnya hilang.
                  Kalau suatu saat ingin merahnya kembali, jalannya bukan filter
                  di sini melainkan file logo versi terang (teks putih, merah
                  tetap merah) — taruh sebagai aset terpisah dan hapus kelas
                  `brightness-0 invert` ini. */}
              <Image
                src="/images/Logo HNS IT Center.png"
                alt="HNS IT Center Logo"
                width={160}
                height={49}
                className="h-10 w-auto object-contain brightness-0 invert"
              />
            </Link>
            {/* `text-white/70` menggantikan `text-muted-foreground`. Token itu
                bernilai #141414 (nyaris hitam) — dirancang untuk latar terang,
                dan di atas navy kontrasnya jatuh ke ~1.5:1, praktis tak
                terbaca. Putih 70% mencapai ~8:1, lolos WCAG AA dengan lega. */}
            <p className="text-sm text-white/70 leading-relaxed">
              Pusat IT & Gaming terpercaya di Batam. Harga terbaik, garansi resmi, teknisi berpengalaman.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="text-white/70 hover:text-white text-sm font-medium">
                Instagram
              </Link>
              <Link href="#" className="text-white/70 hover:text-white text-sm font-medium">
                Facebook
              </Link>
              <Link href="#" className="text-white/70 hover:text-white text-sm font-medium">
                Twitter
              </Link>
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider">Perusahaan</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/about" className="hover:text-white hover:underline">Tentang Kami</Link></li>
              <li><Link href="/stores" className="hover:text-white hover:underline">Toko Fisik</Link></li>
              <li><Link href="/contact" className="hover:text-white hover:underline">Kontak Kami</Link></li>
              <li><Link href="/blog" className="hover:text-white hover:underline">Blog</Link></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider">Bantuan</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/support" className="hover:text-white hover:underline">Pusat Bantuan & Klaim Garansi</Link></li>
              <li><Link href="/faq" className="hover:text-white hover:underline">FAQ</Link></li>
              {/* Footer dirender di setiap halaman, jadi tautan ini sekaligus
                  jalan masuk crawler ke /tools. Sebelumnya halaman itu tidak
                  ditaut dari mana pun — dan halaman tanpa tautan masuk praktis
                  tidak pernah ditelusuri mesin pencari. */}
              <li><Link href="/tools" className="hover:text-white hover:underline">Tes Keyboard, Mouse & Gamepad</Link></li>
              <li><Link href="/kebijakan/pengembalian-barang" className="hover:text-white hover:underline">Kebijakan Pengembalian Barang</Link></li>
              <li><Link href="/kebijakan/pengembalian-dana" className="hover:text-white hover:underline">Kebijakan Pengembalian Dana</Link></li>
              <li><Link href="/kebijakan/pembatalan-pesanan" className="hover:text-white hover:underline">Kebijakan Pembatalan Pesanan</Link></li>
              <li><Link href="/kebijakan/pengiriman" className="hover:text-white hover:underline">Kebijakan Pengiriman</Link></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider">Metode Pembayaran</h4>
            {/* Dulu `bg-background` (putih). Di atas navy kotak putih itu
                menyala dan menarik mata lebih kuat daripada tautan di
                sebelahnya, padahal ia cuma keterangan. Putih transparan
                membuatnya terbaca sebagai permukaan yang sedikit terangkat
                dari footer, bukan tempelan. */}
            <div className="flex gap-2 flex-wrap">
              <span className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium">BCA</span>
              <span className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium">Mandiri</span>
              <span className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium">BRI</span>
              <span className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium">BNI</span>
              <span className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium">QRIS</span>
            </div>
            
            <h4 className="text-sm font-bold uppercase tracking-wider pt-4">Kontak</h4>
            <ul className="space-y-1 text-sm text-white/70">
              <li>
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">
                  WA: {env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER}
                </a>
              </li>
              <li>
                <a href="mailto:cs@hnsitcenter.co.id" className="hover:text-white hover:underline">
                  cs@hnsitcenter.co.id
                </a>
              </li>
            </ul>
          </div>
          
        </div>
        
        <div className="mt-12 border-t border-white/15 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/60">
          <p>© 2026 HNS IT Center. All rights reserved.</p>
          <p>Batam - Kepulauan Riau - Indonesia</p>
        </div>
      </div>
    </footer>
  )
}
