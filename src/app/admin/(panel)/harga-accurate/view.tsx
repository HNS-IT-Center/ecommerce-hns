"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { formatRupiah } from "@/lib/utils"
import type { AccuratePricePreview } from "@/lib/services/accurate-price"
import {
  refreshPreviewAction,
  terapkanHargaAction,
  importSheetAction,
  type TerapkanHasil,
} from "./actions"
import type { ImportResult } from "@/lib/api/accurate/import-sheet"

/**
 * Tabel pratinjau harga Accurate vs katalog + penerapan terpilih.
 *
 * CATATAN ROLE: halaman ini di balik login admin (layout panel), tapi BELUM ada
 * pembatasan role granular — semua admin yang bisa masuk bisa melihat & mengubah
 * harga di sini. Saat role ditambahkan, batasi akses di layout/route, bukan di
 * komponen ini.
 *
 * Baris ber-`peringatan` (harga kosong, angka aneh seperti "145" yang mungkin
 * ribuan terpotong, atau selisih ekstrem) TIDAK ikut tercentang otomatis dan
 * checkbox-nya dinonaktifkan bila harganya memang tak ada. Peringatannya
 * ditampilkan sebagai catatan — staff yang memutuskan, sesuai permintaan.
 */
export function HargaAccurateView({ initial }: { initial: AccuratePricePreview }) {
  const [preview, setPreview] = React.useState(initial)
  // Seleksi pakai kodeAccurate (unik per baris), BUKAN wooId — satu wooId bisa
  // muncul di beberapa baris.
  const [dipilih, setDipilih] = React.useState<Set<string>>(new Set())
  const [pending, startTransition] = React.useTransition()
  const [hasil, setHasil] = React.useState<TerapkanHasil | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [konfirmImport, setKonfirmImport] = React.useState(false)
  const [importHasil, setImportHasil] = React.useState<ImportResult | null>(null)

  // Baris yang BOLEH diterapkan: punya harga Accurate & harganya beda dari web.
  const dapatDiterapkan = React.useMemo(
    () =>
      preview.rows.filter(
        (r) =>
          r.hargaAccurate.nilai !== null &&
          r.selisihPersen !== null &&
          Math.abs(r.selisihPersen) > 0.01,
      ),
    [preview.rows],
  )

  function toggle(kode: string) {
    setDipilih((prev) => {
      const next = new Set(prev)
      if (next.has(kode)) next.delete(kode)
      else next.add(kode)
      return next
    })
  }

  function pilihSemuaAman() {
    // "Aman" = dapat diterapkan DAN tanpa peringatan.
    const aman = dapatDiterapkan.filter((r) => r.peringatan === null).map((r) => r.kodeAccurate)
    setDipilih(new Set(aman))
  }

  function segarkan() {
    setError(null)
    setHasil(null)
    startTransition(async () => {
      const res = await refreshPreviewAction()
      if (res.error || !res.preview) {
        setError(res.error ?? "Gagal memuat.")
        return
      }
      setPreview(res.preview)
      setDipilih(new Set())
    })
  }

  function impor() {
    setKonfirmImport(false)
    setError(null)
    setImportHasil(null)
    startTransition(async () => {
      const res = await importSheetAction()
      if (res.error || !res.hasil) {
        setError(res.error ?? "Gagal impor.")
        return
      }
      setImportHasil(res.hasil)
      // Muat ulang pratinjau supaya data baru ikut tampil.
      const fresh = await refreshPreviewAction()
      if (fresh.preview) setPreview(fresh.preview)
    })
  }

  function terapkan() {
    setError(null)
    setHasil(null)
    const items = preview.rows
      .filter((r) => dipilih.has(r.kodeAccurate) && r.hargaAccurate.nilai !== null)
      .map((r) => ({ wooId: r.wooId, regularPrice: r.hargaAccurate.nilai as number }))

    if (items.length === 0) {
      setError("Belum ada baris yang dipilih.")
      return
    }

    startTransition(async () => {
      const res = await terapkanHargaAction(items)
      setHasil(res)
      // Muat ulang supaya harga web yang baru ikut tercermin.
      const fresh = await refreshPreviewAction()
      if (fresh.preview) setPreview(fresh.preview)
      setDipilih(new Set())
    })
  }

  if (!preview.configured) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Data Accurate belum tersedia.</p>
        <p className="mt-1">
          Tabel <code>accurate_products</code> belum ada di database. Impor dulu data
          Accurate (harga &amp; pemetaan) ke katalog, lalu buka halaman ini lagi.
        </p>
      </div>
    )
  }

  const { ringkasan } = preview

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kartu label="Termapping" nilai={ringkasan.totalTerpetakan} />
        <Kartu label="Cocok di web" nilai={ringkasan.cocokDiWeb} />
        <Kartu label="Harga beda" nilai={ringkasan.hargaBeda} />
        <Kartu label="Ada peringatan" nilai={ringkasan.adaPeringatan} warna />
      </div>

      {/* Aksi */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setKonfirmImport(true)} disabled={pending}>
          Import Data
        </Button>
        <Button variant="outline" size="sm" onClick={segarkan} disabled={pending}>
          {pending ? "Memuat…" : "Segarkan"}
        </Button>
        <Button variant="outline" size="sm" onClick={pilihSemuaAman} disabled={pending}>
          Pilih semua yang aman
        </Button>
        <Button size="sm" onClick={terapkan} disabled={pending || dipilih.size === 0}>
          Terapkan {dipilih.size > 0 ? `(${dipilih.size})` : ""}
        </Button>
      </div>

      {/* Dialog konfirmasi import */}
      {konfirmImport && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">Import Data dari Google Sheet?</p>
          <p className="mt-1 text-muted-foreground">
            Menyedot seluruh data barang (nama, kategori, brand, status, stok) dari Sheet dan
            memperbarui katalog Accurate. <b>Harga tidak diubah</b> — itu diisi terpisah. Proses
            beberapa detik.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={impor} disabled={pending}>
              {pending ? "Mengimpor…" : "Ya, Import Sekarang"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setKonfirmImport(false)} disabled={pending}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {importHasil && (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm">
          Import selesai: <b>{importHasil.baru}</b> baru, <b>{importHasil.diperbarui}</b> diperbarui
          {importHasil.dilewati > 0 && <span className="text-destructive"> · {importHasil.dilewati} dilewati</span>}
          {" "}(dari {importHasil.totalBaris} baris Sheet).
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasil && (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm">
          Berhasil menerapkan {hasil.berhasil} harga.
          {hasil.gagal.length > 0 && (
            <span className="text-destructive">
              {" "}
              Gagal {hasil.gagal.length}: {hasil.gagal.map((g) => `#${g.wooId} (${g.alasan})`).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Tabel */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="w-10 p-2"></th>
              <th className="p-2">Produk</th>
              <th className="p-2 text-right">Harga web</th>
              <th className="p-2 text-right">Harga Accurate</th>
              <th className="p-2 text-right">Selisih</th>
              <th className="p-2">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r) => {
              const bisa =
                r.hargaAccurate.nilai !== null &&
                r.selisihPersen !== null &&
                Math.abs(r.selisihPersen) > 0.01
              return (
                <tr key={r.kodeAccurate} className="border-t align-top">
                  <td className="p-2">
                    <Checkbox
                      checked={dipilih.has(r.kodeAccurate)}
                      disabled={!bisa || pending}
                      onCheckedChange={() => toggle(r.kodeAccurate)}
                      aria-label={`Pilih ${r.nama}`}
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{r.nama}</div>
                    <div className="text-xs text-muted-foreground">
                      woo_id {r.wooId} · {r.status}
                    </div>
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {r.hargaWebSekarang === null ? "—" : formatRupiah(r.hargaWebSekarang)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {r.hargaAccurate.nilai === null ? "—" : formatRupiah(r.hargaAccurate.nilai)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {r.selisihPersen === null ? "—" : `${r.selisihPersen > 0 ? "+" : ""}${r.selisihPersen.toFixed(0)}%`}
                  </td>
                  <td className="p-2">
                    {r.peringatan ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400">⚠️ {r.peringatan}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {preview.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                  Tidak ada produk termapping yang cocok dengan katalog.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kartu({ label, nilai, warna }: { label: string; nilai: number; warna?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${warna && nilai > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
        {nilai}
      </div>
    </div>
  )
}
