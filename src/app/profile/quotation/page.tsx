import Link from "next/link"
import { redirect } from "next/navigation"
import { Search } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import {
  listQuotationsForUser,
  summarizeSalesMonth,
  type QuotationHistoryRow,
} from "@/lib/api/pc-build-quotes"
import { formatRupiah } from "@/lib/utils"
import { formatJakartaPeriod, jakartaPeriod } from "@/lib/utils/timezone"
import { formatQuoteDateTime } from "@/app/verify/format"
import { ProfileTabs } from "@/features/account/components/profile-tabs"
import { HandoverToast } from "@/features/quotation/components/handover-toast"

export const metadata = {
  title: "Quotation Saya",
  robots: { index: false, follow: false },
}

/**
 * Riwayat quotation milik staff.
 *
 * Dijaga di halaman ini sendiri, bukan lewat `requirePageView`: kuncinya
 * (`quotation-terbit`) bukan segmen di bawah `/admin`, jadi `pageFromPathname`
 * tidak akan pernah mengembalikannya. Pola yang sama dipakai `/verify`.
 *
 * Yang dituntut `edit`, bukan `view`: menerbitkan quotation atas nama pelanggan
 * dan memilikinya adalah satu kemampuan yang sama, dan tidak ada gunanya
 * melihat riwayat yang tidak akan pernah terisi.
 */
export default async function QuotationSayaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; periode?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=/profile/quotation")

  const izin = await muatIzinUser(user)
  if (!bisaAkses(izin, "quotation-terbit", "edit")) redirect("/profile")

  const { q, tab, periode: periodeRaw } = await searchParams
  const adalahSales = bisaAkses(izin, "quotation-sales", "edit")
  const lihatOperan = tab === "dioper"
  const periode = /^\d{6}$/.test(periodeRaw ?? "") ? periodeRaw! : jakartaPeriod(new Date())

  const [rows, rekap] = await Promise.all([
    listQuotationsForUser(user.id, { peran: lihatOperan ? "dioper" : "milik", q }),
    summarizeSalesMonth(user.id, periode),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Header />
      <main className="flex-1 p-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Quotation Saya</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quotation rakitan PC yang Anda terbitkan untuk pelanggan.
            </p>
          </div>

          <ProfileTabs active="quotation" />

          {/* Lihat catatan di /build-pc: tidak dipasang di root layout
              supaya storefront tidak ikut kehilangan rendering statis. */}
          {adalahSales && <HandoverToast />}

          {/* Rekap penjualan bulan berjalan. Dihitung dari tanggal CLOSING —
              quotation Agustus yang deal September adalah penjualan September. */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Penjualan {formatJakartaPeriod(periode)}
                </p>
                <p className="mt-1 text-2xl font-extrabold">{formatRupiah(rekap.total)}</p>
                <p className="text-sm text-muted-foreground">
                  {rekap.unit} quotation ditandai terjual
                </p>
              </div>

              <PemilihBulan periodeAktif={periode} q={q} tab={tab} />
            </div>
          </section>

          {/* Tab "Yang saya oper" hanya berarti bagi CS. Sales tidak mengoper
              ke siapa pun, jadi bagi mereka tab itu selalu kosong. */}
          {!adalahSales && (
            <div className="flex gap-2">
              <FilterLink label="Milik saya" href={hrefDengan({ q, tab: undefined })} aktif={!lihatOperan} />
              <FilterLink label="Yang saya oper" href={hrefDengan({ q, tab: "dioper" })} aktif={lihatOperan} />
            </div>
          )}

          <form action="/profile/quotation" className="flex gap-2">
            {lihatOperan && <input type="hidden" name="tab" value="dioper" />}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Cari kode, nama pelanggan, atau nomor HP…"
                className="w-full rounded-xl border border-input bg-muted/50 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Cari
            </button>
          </form>

          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              {q
                ? `Tidak ada quotation yang cocok dengan "${q}".`
                : lihatOperan
                  ? "Belum ada quotation yang Anda oper ke Sales."
                  : "Belum ada quotation. Terbitkan lewat halaman Rakit PC."}
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.code}>
                  <KartuQuotation row={row} bisaDibuka={!lihatOperan} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function hrefDengan({ q, tab }: { q?: string; tab?: string }): string {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (tab) params.set("tab", tab)
  const qs = params.toString()
  return qs ? `/profile/quotation?${qs}` : "/profile/quotation"
}

function FilterLink({ label, href, aktif }: { label: string; href: string; aktif: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        aktif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  )
}

/**
 * Tiga bulan terakhir saja.
 *
 * Rekap bulanan dipakai untuk melihat capaian yang sedang berjalan dan yang
 * baru lewat; daftar dua belas bulan hanya membuat pemilihnya panjang tanpa
 * ada yang benar-benar membukanya.
 */
function PemilihBulan({
  periodeAktif,
  q,
  tab,
}: {
  periodeAktif: string
  q?: string
  tab?: string
}) {
  const pilihan: string[] = []
  const kini = jakartaPeriod(new Date())
  let tahun = Number(kini.slice(0, 4))
  let bulan = Number(kini.slice(4, 6))

  /**
   * Dihitung dari angka periode, BUKAN dengan `setUTCMonth(bulan - 1)` pada
   * sebuah Date. Mengurangi satu bulan dari tanggal 31 melompati bulan yang
   * lebih pendek — 31 Maret mundur satu bulan menjadi 3 Maret, bukan Februari —
   * sehingga pemilihnya kehilangan satu bulan tepat di akhir bulan panjang.
   */
  for (let mundur = 0; mundur < 3; mundur++) {
    pilihan.push(`${tahun}${String(bulan).padStart(2, "0")}`)
    bulan -= 1
    if (bulan === 0) {
      bulan = 12
      tahun -= 1
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {pilihan.map((p) => {
        const params = new URLSearchParams()
        if (q) params.set("q", q)
        if (tab) params.set("tab", tab)
        params.set("periode", p)
        return (
          <Link
            key={p}
            href={`/profile/quotation?${params.toString()}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              p === periodeAktif
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {formatJakartaPeriod(p)}
          </Link>
        )
      })}
    </div>
  )
}

/** `0812****7890` — nomor HP disamarkan di daftar; utuh hanya di halaman detail. */
function samarkanHp(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return phone
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`
}

function KartuQuotation({ row, bisaDibuka }: { row: QuotationHistoryRow; bisaDibuka: boolean }) {
  const terjual = row.status === "closing"

  const isi = (
    <div className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-sm font-bold">
            {row.code}
            {row.revision > 1 && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-muted-foreground">
                Rev. {row.revision}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 font-sans text-xs font-semibold ${
                terjual
                  ? "bg-brand-green/15 text-brand-green"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {terjual ? "Terjual" : "Terbit"}
            </span>
          </p>

          <p className="mt-1 truncate text-sm font-semibold">
            {row.customerName ?? "Tanpa nama pelanggan"}
          </p>
          {row.customerPhone && (
            <p className="text-xs text-muted-foreground">{samarkanHp(row.customerPhone)}</p>
          )}

          {row.dioperDariCs && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Dioper dari CS{row.dioperOleh ? ` · ${row.dioperOleh}` : ""}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="font-bold">{formatRupiah(row.total)}</p>
          <p className="text-xs text-muted-foreground">{row.itemCount} item</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatQuoteDateTime(row.createdAt)}
          </p>
        </div>
      </div>
    </div>
  )

  if (!bisaDibuka) return isi

  return (
    <Link href={`/profile/quotation/${row.code}`} className="block">
      {isi}
    </Link>
  )
}

export const dynamic = "force-dynamic"
