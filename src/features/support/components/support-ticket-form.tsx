import { Ticket, ShieldCheck, MessageCircle } from "lucide-react"

/**
 * Halaman klaim garansi & servis.
 *
 * **Kotak pencarian tiket sengaja dimatikan, bukan dihapus.** Sebelumnya ia
 * mengirim pelanggan ke alamat placeholder yang tidak pernah diganti:
 *
 *     https://[link-supabase-anda.com]/tiket/HNS-240101-001
 *
 * Tanda kurung siku itu ikut terkirim apa adanya, jadi browser gagal
 * menemukan hostnya dan pelanggan mendarat di halaman error — sudah
 * meninggalkan situs HNS, atas nama tombol bertuliskan "Cari". Halaman ini
 * ditaut dari footer SETIAP halaman, jadi jangkauannya bukan sudut yang jarang
 * dikunjungi.
 *
 * Supabase juga tidak ada di tech stack (CLAUDE.md §4 menetapkan Prisma /
 * MariaDB), dan tidak ada model tiket maupun pesanan di `prisma/schema.prisma`.
 * Fitur pelacakannya bukan "belum disambung" — belum pernah ada.
 *
 * Kolomnya tetap ditampilkan dalam keadaan mati supaya halaman ini jujur soal
 * apa yang sedang disiapkan, sementara jalur yang benar-benar bekerja —
 * WhatsApp — berdiri di sebelahnya. Menyalakannya kembali butuh backend tiket
 * yang sungguhan, bukan sekadar mengganti URL.
 */
export function SupportTicketForm({ waUrl }: { waUrl: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card p-8 text-center shadow-xl md:p-12">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-sale-red/10">
        <ShieldCheck className="h-10 w-10 text-sale-red" />
      </div>

      <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
        Pusat Bantuan &amp; Klaim Garansi
      </h1>
      <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
        Untuk klaim garansi, servis, atau menanyakan status pengerjaan, hubungi tim kami lewat
        WhatsApp. Siapkan nomor nota pembelian atau nomor tiket servis Anda.
      </p>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-8 py-4 text-base font-bold text-white transition-opacity hover:opacity-90"
      >
        <MessageCircle className="h-5 w-5" />
        Hubungi Lewat WhatsApp
      </a>

      <div className="mx-auto mt-12 max-w-xl border-t pt-8">
        <p className="mb-4 text-sm font-semibold text-muted-foreground">
          Pelacakan tiket online belum tersedia
        </p>

        <div className="relative flex items-center opacity-60">
          <Ticket className="absolute left-4 h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            placeholder="Contoh: HNS-240101-001"
            disabled
            aria-label="Pelacakan tiket online belum tersedia"
            className="h-16 w-full cursor-not-allowed rounded-2xl border-2 border-input bg-muted/40 pl-14 pr-32 text-lg outline-none"
          />
          <button
            type="button"
            disabled
            className="absolute bottom-2 right-2 top-2 cursor-not-allowed rounded-xl bg-muted px-6 font-bold text-muted-foreground"
          >
            Cari
          </button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Sedang disiapkan. Sementara ini, status pengerjaan bisa ditanyakan langsung lewat
          WhatsApp di atas.
        </p>
      </div>
    </div>
  )
}
