"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { ImportResult } from "@/lib/api/accurate/import-sheet"

import { importSheetAction } from "./actions"

/**
 * Tombol "Import dari Google Sheet" — berdiri sendiri, sengaja.
 *
 * Sebelumnya tombol ini hidup di dalam `view.tsx`, satu komponen dengan mesin
 * penerapan harga SP. Ketika penerapan itu dimatikan 19 September 2026 dan
 * `view.tsx` berhenti dirender, tombol impor ikut hilang dari layar tanpa ada
 * yang bermaksud menghilangkannya — padahal impor data barang dari gudang tidak
 * punya hubungan apa pun dengan penerapan harga. Yang satu menulis nama,
 * kategori, brand, status, dan stok ke `accurate_products`; yang satunya menulis
 * harga ke katalog yang dilihat pelanggan.
 *
 * Dipisah supaya kejadian itu tidak terulang: mematikan salah satunya tidak lagi
 * ikut mematikan yang lain.
 *
 * Impor ini TIDAK menyentuh harga sama sekali — Sheet gudang memang tidak punya
 * kolom harga, dan itu disengaja (docs/13 §1).
 */
export function ImportSheetButton() {
  const router = useRouter()
  const [konfirmasi, setKonfirmasi] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [hasil, setHasil] = React.useState<ImportResult | null>(null)
  const [galat, setGalat] = React.useState<string | null>(null)

  async function impor() {
    setPending(true)
    setGalat(null)
    setHasil(null)
    try {
      const res = await importSheetAction()
      if (res.error || !res.hasil) {
        setGalat(res.error ?? "Gagal impor dari Sheet.")
        return
      }
      setHasil(res.hasil)
      // Tabel di halaman ini dirender di server. Tanpa muat ulang, hasil impor
      // baru terlihat setelah orangnya menekan segarkan sendiri — dan angka
      // "N produk" di atas tabel akan bertentangan dengan angka hasil impor.
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setKonfirmasi(true)}
        disabled={pending}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        {pending ? "Mengimpor…" : "Import dari Google Sheet"}
      </Button>

      <ConfirmDialog
        open={konfirmasi}
        onOpenChange={setKonfirmasi}
        title="Import data barang dari Google Sheet?"
        description="Menyedot seluruh data barang (nama, kategori, brand, status, stok) dari Sheet gudang dan memperbarui daftar Accurate. Harga tidak ikut diubah — Sheet memang tidak memuat kolom harga. Prosesnya beberapa detik."
        confirmLabel="Ya, import sekarang"
        onConfirm={impor}
      />

      {hasil && (
        <p className="text-xs text-success">
          Import selesai: <b>{hasil.baru}</b> baru, <b>{hasil.diperbarui}</b> diperbarui
          {hasil.dilewati > 0 && (
            <span className="text-destructive"> · {hasil.dilewati} dilewati</span>
          )}{" "}
          (dari {hasil.totalBaris} baris Sheet).
        </p>
      )}

      {galat && <p className="text-xs text-destructive">{galat}</p>}
    </div>
  )
}
