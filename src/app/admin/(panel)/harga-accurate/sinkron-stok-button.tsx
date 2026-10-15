"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

import { sinkronStokAccurateAction, type SinkronStokHasil } from "./actions"

const angka = (n: number) => n.toLocaleString("id-ID")

/**
 * Tombol "Sinkron Stok Sekarang" — menarik seluruh barang dari API Data
 * Accurate. Jalur utamanya webhook (otomatis tiap Data Accurate selesai
 * sinkron); tombol ini cadangan dan untuk tarikan pertama.
 *
 * Butuh ±10–30 detik (±13 permintaan API + penulisan), jadi tombolnya
 * dikunci selama berjalan — menekan dua kali hanya membuat dua sinkron.
 */
export function SinkronStokButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [hasil, setHasil] = useState<SinkronStokHasil | null>(null)

  function jalankan() {
    setHasil(null)
    startTransition(async () => {
      const h = await sinkronStokAccurateAction()
      setHasil(h)
      if (h.ok) router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button type="button" onClick={jalankan} disabled={pending} className="gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {pending ? "Menyinkronkan…" : "Sinkron Stok Sekarang"}
      </Button>
      {hasil && (
        <p
          role="status"
          className={`text-xs ${hasil.ok ? "text-muted-foreground" : "font-medium text-destructive"}`}
        >
          {hasil.ok
            ? `${angka(hasil.itemsReceived)} barang dibaca · ${angka(hasil.productsUpdated)} produk diperbarui`
            : hasil.error}
        </p>
      )}
    </div>
  )
}
