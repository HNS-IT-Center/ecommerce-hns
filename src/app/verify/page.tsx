import Link from "next/link"
import { FileSearch } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"
import { requirePageView } from "@/lib/auth"
import {
  listRecentQuotes,
  parseQuoteSort,
  type QuoteSort,
  type QuoteSummary,
} from "@/lib/api/pc-build-quotes"
import { cn, formatRupiah } from "@/lib/utils"
import { formatQuoteDateTime } from "./format"
import { VerifySearchForm } from "./verify-search-form"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Verifikasi Rakitan PC",
  // Alat internal kasir; tidak untuk mesin pencari.
  robots: { index: false, follow: false },
}

const RECENT_LIMIT = 15

const SORT_OPTIONS: { value: QuoteSort; label: string }[] = [
  { value: "dicetak", label: "Terakhir dicetak" },
  { value: "dibuat", label: "Tanggal dibuat" },
]

function QuoteCard({ quote, sort }: { quote: QuoteSummary; sort: QuoteSort }) {
  // Tanggal yang ditampilkan mengikuti urutan yang dipilih — kalau grid
  // diurutkan menurut waktu cetak tapi kartunya menulis tanggal dibuat,
  // urutannya tampak acak.
  const date = sort === "dibuat" ? quote.createdAt : quote.updatedAt

  return (
    <Link
      href={`/verify/${quote.code}`}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <p className="font-mono text-sm font-bold tracking-tight group-hover:text-primary">
        {quote.code}
      </p>
      <p className="text-lg font-black tabular-nums text-sale-red">
        {formatRupiah(quote.total)}
      </p>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{formatQuoteDateTime(date)}</span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-semibold">
          {quote.itemCount} item
        </span>
      </div>
    </Link>
  )
}

export default async function VerifyBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Khusus kasir & admin (izin `verify`). Tanpa akses → beranda; lihat src/proxy.ts.
  await requirePageView("verify", { deniedRedirect: "/" })

  const sort = parseQuoteSort((await searchParams).urut)
  const quotes = await listRecentQuotes(sort, RECENT_LIMIT)

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Header />
      <Breadcrumb
        items={[{ label: "Beranda", href: "/" }, { label: "Cek Rakitan PC" }]}
      />
      <main className="flex-1 bg-muted/20">
        {/* Area kerja kasir setinggi satu layar (100dvh) di desktop: judul &
            pencarian tetap di tempat, hanya grid yang menggulir. Di HP halaman
            menggulir biasa — gulir-di-dalam-gulir di layar sempit menjebak. */}
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 md:px-6 lg:h-dvh">
          <div className="shrink-0">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              Cek Rincian Rakitan PC
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Ketik sebagian kode quotation — akhiran, tanggal, atau awalannya — lalu pilih dari
              daftar.
            </p>
            <div className="mt-4">
              <VerifySearchForm />
            </div>
          </div>

          <div className="mt-8 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {RECENT_LIMIT} rakitan terakhir
            </h2>
            <nav aria-label="Urutkan" className="flex rounded-lg border border-border bg-background p-0.5">
              {SORT_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={option.value === "dicetak" ? "/verify" : `/verify?urut=${option.value}`}
                  aria-current={sort === option.value ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    sort === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>

          {quotes.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <FileSearch className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Belum ada quotation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Quotation tercatat otomatis setiap kali pelanggan mencetak rakitan dari halaman Rakit PC.
              </p>
            </div>
          ) : (
            // Di desktop hanya area ini yang menggulir; judul & pencarian tetap di
            // tempat. `pr-1` memberi jarak supaya scrollbar tidak menempel kartu.
            <div className="mt-3 min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
              <ul className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-3">
                {quotes.map((quote) => (
                  <li key={quote.code}>
                    <QuoteCard quote={quote} sort={sort} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
