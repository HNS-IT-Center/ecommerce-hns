import { Boxes } from "lucide-react"

import type { AccurateInfoRow } from "@/lib/api/accurate/stock-sync"
import { formatQuoteDateTime } from "@/app/verify/format"
import { formatRupiah } from "@/lib/utils"

/**
 * Kartu "Data Accurate" di halaman edit produk — stok per gudang dan, HANYA
 * untuk pemegang izin `harga-modal`, HPP rata-rata (docs/13 §10).
 *
 * Server Component: angka HPP sudah disaring di `getAccurateInfoForProduct`
 * sebelum sampai ke sini, jadi tanpa izin ia memang tidak pernah dikirim ke
 * peramban — bukan sekadar disembunyikan dengan CSS.
 */
export function AccurateStockCard({
  rows,
  bolehLihatModal,
}: {
  rows: AccurateInfoRow[]
  bolehLihatModal: boolean
}) {
  if (rows.length === 0) return null

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Boxes className="h-4 w-4 text-primary" />
        Data Accurate
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Stok produk yang tertaut mengikuti Accurate — suntingan stok manual akan tertimpa sinkron
        berikutnya. Harga jual tetap diatur di web.
      </p>

      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={row.code} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0 font-semibold break-words">
                {row.label} <span className="font-mono text-xs font-normal text-muted-foreground">{row.code}</span>
              </p>
              {row.info && (
                <p className="text-xs text-muted-foreground">
                  Disalin {formatQuoteDateTime(row.info.syncedAt)}
                </p>
              )}
            </div>

            {row.info ? (
              <>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                  <p>
                    Stok web <strong className="tabular-nums">{row.info.stockWeb.toLocaleString("id-ID")}</strong>
                  </p>
                  {bolehLihatModal && (
                    <p>
                      HPP Accurate{" "}
                      <strong className="tabular-nums">
                        {row.info.cost !== null ? formatRupiah(row.info.cost) : "—"}
                      </strong>
                    </p>
                  )}
                </div>
                {row.info.warehouses.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {row.info.warehouses.map((g) => (
                      <li
                        key={g.name}
                        title={g.dihitung ? "Dihitung sebagai stok web" : "Tidak dihitung sebagai stok web"}
                        className={`rounded-full px-2 py-0.5 ${
                          g.dihitung ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground line-through"
                        }`}
                      >
                        {g.name}: {g.quantity.toLocaleString("id-ID")}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-1 text-xs text-amber-600">
                Belum ada data — kodenya belum terbaca di sinkron stok, atau tidak dikenal Accurate.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
