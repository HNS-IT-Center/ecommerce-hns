import type { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"

import { requirePageView } from "@/lib/auth"
import { bisaAkses } from "@/lib/auth/permissions"
import {
  ADMIN_QUOTATION_PAGE_SIZE,
  listQuotationOwners,
  listQuotationsForAdmin,
  summarizeSalesByMonth,
} from "@/lib/api/pc-build-quotes"
import { AdminPagination } from "@/components/admin/admin-pagination"
import { formatRupiah } from "@/lib/utils"
import { formatJakartaPeriod, jakartaPeriod } from "@/lib/utils/timezone"
import { formatQuoteDateTime } from "@/app/verify/format"

import { ReopenButton } from "./reopen-button"

export const metadata: Metadata = {
  title: "Quotation & Penjualan — Admin",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{
    q?: string
    periode?: string
    sales?: string
    status?: string
    page?: string
  }>
}

/**
 * Pengawasan quotation lintas sales + rekap penjualan bulanan.
 *
 * Satu-satunya tempat status TERJUAL bisa dibatalkan. Kasir yang menandainya
 * tidak bisa menariknya kembali — kalau bisa, dialog konfirmasi di `/verify`
 * berhenti menjadi pengaman dan berubah jadi formalitas.
 *
 * Nomor HP dan catatan internal terlihat di sini (bukan di `/verify`), karena
 * admin memang yang menindaklanjuti keluhan dan menelusuri apa yang terjadi.
 */
export default async function AdminQuotationPage({ searchParams }: Props) {
  const { izin } = await requirePageView("quotation")
  const bolehBatalkan = bisaAkses(izin, "quotation", "edit")

  const { q, periode: periodeRaw, sales, status, page } = await searchParams
  const periode = /^\d{6}$/.test(periodeRaw ?? "") ? periodeRaw! : jakartaPeriod(new Date())
  // `?page=abc` dan `?page=0` sama-sama jatuh ke halaman 1 — bukan ke `skip`
  // negatif yang membuat Prisma melempar dan seluruh halaman gagal dirender.
  const halaman = Math.max(1, Number(page ?? 1) || 1)

  const [daftar, rekap, owners] = await Promise.all([
    listQuotationsForAdmin({ q, ownerUserId: sales, status, page: halaman }),
    summarizeSalesByMonth(periode),
    listQuotationOwners(),
  ])
  const rows = daftar.rows

  const totalRekap = rekap.reduce((acc, r) => acc + r.total, 0)
  const unitRekap = rekap.reduce((acc, r) => acc + r.unit, 0)

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Quotation &amp; Penjualan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seluruh quotation rakitan PC lintas sales, beserta rekap penjualan bulanannya.
        </p>
      </div>

      {/* ---------- Rekap bulanan ---------- */}
      <section className="mt-6 rounded-2xl border border-border bg-background p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-bold">Penjualan {formatJakartaPeriod(periode)}</h2>
            <p className="text-sm text-muted-foreground">
              {unitRekap} quotation terjual · {formatRupiah(totalRekap)}
            </p>
          </div>
          <PemilihPeriode aktif={periode} q={q} sales={sales} status={status} />
        </div>

        {rekap.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada quotation yang ditandai terjual pada bulan ini.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {rekap.map((r) => (
              <li key={r.ownerUserId} className="flex items-center justify-between gap-4 p-3">
                <span className="truncate text-sm font-semibold">{r.nama}</span>
                <span className="shrink-0 text-right text-sm">
                  <span className="font-bold">{formatRupiah(r.total)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.unit} unit</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Saringan ----------
          Formulir GET ini sengaja TIDAK membawa `page`: menyaring ulang selalu
          mengembalikan ke halaman pertama. "Halaman 7" dari hasil saringan lama
          tidak menunjuk apa pun setelah saringannya berganti. Pemilih periode
          di atas merakit parameternya sendiri dengan alasan yang sama. */}
      <form action="/admin/quotation" className="mt-6 flex flex-wrap gap-2">
        <input type="hidden" name="periode" value={periode} />
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari kode, nama pelanggan, atau nomor HP…"
            className="w-full rounded-xl border border-input bg-muted/50 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
          />
        </div>

        <select
          name="sales"
          defaultValue={sales ?? ""}
          className="rounded-xl border border-input bg-muted/50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-background"
        >
          <option value="">Semua sales</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-xl border border-input bg-muted/50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-background"
        >
          <option value="">Semua status</option>
          <option value="terbit">Terbit</option>
          <option value="closing">Terjual</option>
        </select>

        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Terapkan
        </button>
      </form>

      {/* ---------- Daftar quotation ---------- */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3 font-medium">Kode</th>
              <th className="p-3 font-medium">Pelanggan</th>
              <th className="p-3 font-medium">Sales</th>
              <th className="p-3 text-right font-medium">Total</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Terbit</th>
              {bolehBatalkan && <th className="p-3 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={bolehBatalkan ? 7 : 6}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  Tidak ada quotation yang cocok dengan saringan ini.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const terjual = row.status === "closing"
                return (
                  <tr key={row.code} className="border-t border-border align-top">
                    <td className="p-3">
                      <Link
                        href={`/verify/${row.code}`}
                        className="font-mono font-semibold hover:text-primary hover:underline"
                      >
                        {row.code}
                      </Link>
                      {row.revision > 1 && (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          Rev. {row.revision}
                        </span>
                      )}
                      {row.dioperDariCs && (
                        <span className="mt-1 block text-[11px] text-primary">
                          Dioper dari CS{row.dioperOleh ? ` · ${row.dioperOleh}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="block font-medium">{row.customerName ?? "—"}</span>
                      {row.customerPhone && (
                        <span className="block text-xs text-muted-foreground">
                          {row.customerPhone}
                        </span>
                      )}
                      {row.internalNote && (
                        <span className="mt-0.5 block text-xs italic text-muted-foreground">
                          {row.internalNote}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{row.salesName ?? row.ownerName ?? "—"}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">
                      {formatRupiah(row.total)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          terjual
                            ? "bg-brand-green/15 text-brand-green"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {terjual ? "Terjual" : "Terbit"}
                      </span>
                      {terjual && row.closedAt && (
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatQuoteDateTime(row.closedAt)}
                        </span>
                      )}
                      {/* Penanda DP dari sales pemiliknya. Bukan status kedua —
                          ia berdampingan dengan Terbit/Terjual, tidak
                          menggantikannya. */}
                      {row.dpAt && (
                        <span className="mt-1 block text-[11px] font-semibold text-primary">
                          Sudah DP · {formatQuoteDateTime(row.dpAt)}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatQuoteDateTime(row.createdAt)}
                    </td>
                    {bolehBatalkan && (
                      <td className="p-3">
                        {terjual && (
                          <ReopenButton
                            code={row.code}
                            ownerName={row.salesName ?? row.ownerName}
                            total={row.total}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={daftar.page}
        pageCount={daftar.pageCount}
        total={daftar.total}
        pageSize={ADMIN_QUOTATION_PAGE_SIZE}
        labelBaris="quotation"
      />
    </div>
  )
}

/** Tiga bulan terakhir — alasannya sama dengan pemilih di /profile/quotation. */
function PemilihPeriode({
  aktif,
  q,
  sales,
  status,
}: {
  aktif: string
  q?: string
  sales?: string
  status?: string
}) {
  const pilihan: string[] = []
  const kini = jakartaPeriod(new Date())
  let tahun = Number(kini.slice(0, 4))
  let bulan = Number(kini.slice(4, 6))
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
        if (sales) params.set("sales", sales)
        if (status) params.set("status", status)
        params.set("periode", p)
        return (
          <Link
            key={p}
            href={`/admin/quotation?${params.toString()}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              p === aktif
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
