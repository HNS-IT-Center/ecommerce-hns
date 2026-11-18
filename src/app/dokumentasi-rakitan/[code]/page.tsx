import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, Camera, CloudOff, Hammer, SearchX } from "lucide-react"

import { requirePageView } from "@/lib/auth"
import { getBuildDocumentation } from "@/lib/api/ticketing-builds"
import { numberBuildPhotos } from "@/lib/api/ticketing-build-downloads"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { QUOTE_CODE_PATTERN, formatQuoteDateTime } from "@/app/verify/format"
import { BuildPhotoGallery } from "./build-photo-gallery"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Dokumentasi Rakitan",
  robots: { index: false, follow: false },
}

/**
 * /dokumentasi-rakitan/[code] — foto rakitan dari Ticketing untuk satu
 * quotation (docs/17 §21). Link-nya ditempel kasir di catatan faktur Accurate.
 *
 * Wajib login staff + izin `dokumentasi-rakitan`. Kode quotation berurutan dan
 * bisa ditebak, jadi halaman ini TIDAK PERNAH terbuka hanya karena tahu kodenya.
 * Penjaga pertama di `src/proxy.ts` (tanpa sesi → /login), penjaga izin di sini.
 *
 * Tidak membaca database ecommerce: semua isi dari Ticketing, dan Ticketing
 * yang memutuskan apakah kodenya punya tiket.
 */
export default async function BuildDocumentationPage({ params }: { params: Promise<{ code: string }> }) {
  const { izin } = await requirePageView("dokumentasi-rakitan", { deniedRedirect: "/" })
  const { bisaAkses } = await import("@/lib/auth/permissions")
  const bolehVerify = bisaAkses(izin, "verify", "view")

  const { code: rawCode } = await params
  const code = decodeSegment(rawCode)?.trim().toUpperCase() ?? ""
  const shownCode = code.length > 24 ? `${code.slice(0, 24)}…` : code

  if (!QUOTE_CODE_PATTERN.test(code)) {
    return (
      <Shell backHref={bolehVerify ? "/verify" : null} backLabel="Kembali ke Verify">
        <Message icon={<SearchX className="h-6 w-6 text-muted-foreground" />} title="Kode quotation tidak dikenali">
          Kode <span className="font-mono font-semibold">{shownCode || "(kosong)"}</span> tidak sesuai format.
          Kode quotation selalu berawalan <span className="font-mono font-semibold">HNSPC-</span>.
        </Message>
      </Shell>
    )
  }

  const backHref = bolehVerify ? `/verify/${encodeURIComponent(code)}` : null
  const result = await getBuildDocumentation(code)

  if (result.kind === "no-ticket") {
    return (
      <Shell backHref={backHref}>
        <Message icon={<Hammer className="h-6 w-6 text-muted-foreground" />} title="Belum ada tiket rakitan">
          Belum ada tiket rakitan dari quotation <span className="font-mono font-semibold">{code}</span> di
          Ticketing.
        </Message>
      </Shell>
    )
  }

  if (result.kind === "invalid-code") {
    return (
      <Shell backHref={backHref}>
        <Message icon={<SearchX className="h-6 w-6 text-muted-foreground" />} title="Kode quotation tidak dikenali">
          Ticketing tidak mengenali kode <span className="font-mono font-semibold">{code}</span>. Periksa kembali
          kodenya.
        </Message>
      </Shell>
    )
  }

  if (result.kind === "unavailable") {
    return (
      <Shell backHref={backHref}>
        <Message icon={<CloudOff className="h-6 w-6 text-muted-foreground" />} title="Dokumentasi tidak bisa dimuat dari Ticketing">
          Coba muat ulang halaman ini sebentar lagi. Kalau tetap gagal, hubungi admin.
        </Message>
      </Shell>
    )
  }

  const { doc } = result
  const { ticket } = doc
  const groups = numberBuildPhotos(doc.photos)
  const sedangDirakit = ticket.stage === "building"

  const facts: { label: string; value: ReactNode }[] = [
    { label: "Kode tiket", value: <span className="font-mono">{ticket.code}</span> },
    { label: "Tahap", value: ticket.stageLabel ?? ticket.stage ?? "—" },
    { label: "Toko", value: ticket.store ?? "—" },
    { label: "Teknisi", value: ticket.technician ?? "—" },
    { label: "Selesai", value: ticket.finishedAt ? formatDateSafe(ticket.finishedAt) : "—" },
  ]

  return (
    <Shell backHref={backHref}>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Dokumentasi Rakitan</p>
        <h1 className="mt-1 font-mono text-xl font-black tracking-tight break-all md:text-2xl">{code}</h1>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 sm:block sm:border-0 sm:pb-0">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="text-right font-semibold break-words sm:text-left">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {sedangDirakit && (
          <p className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-foreground">
            Sedang dirakit — foto rakitan jadi belum ada.
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-sm text-muted-foreground">
          <Camera className="h-5 w-5 shrink-0" />
          Tiket ini belum punya foto di Ticketing.
        </div>
      ) : (
        <BuildPhotoGallery code={code} groups={groups} />
      )}

      {doc.skippedPhotos > 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {doc.skippedPhotos} foto tidak ditampilkan karena datanya dari Ticketing tidak lengkap.
        </p>
      )}
    </Shell>
  )
}

function decodeSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

/** Tanggal dari sistem lain: yang tidak bisa dibaca ditampilkan apa adanya, bukan melempar. */
function formatDateSafe(value: string): string {
  return Number.isNaN(new Date(value).getTime()) ? value : formatQuoteDateTime(value)
}

function Shell({
  backHref,
  backLabel = "Kembali ke quotation",
  children,
}: {
  backHref: string | null
  backLabel?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <Header />
      <main className="min-h-content flex-1 bg-muted/20 py-6 md:py-8">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          {backHref && (
            <Link
              href={backHref}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          )}
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Message({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm md:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">{icon}</div>
      <h1 className="mt-4 text-lg font-bold md:text-xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
