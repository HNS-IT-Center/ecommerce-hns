"use client"

import { useState } from "react"
import { ArrowRightLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { JsonResponseError } from "@/lib/utils/read-json-response"
import type { SkuConflict } from "@/types/woocommerce"

/**
 * SKU yang ditolak karena dipegang produk lain, dari galat simpan
 * `/api/admin/products`. Kosong kalau galatnya bukan itu — termasuk SKU yang
 * kembar di formulir sendiri, yang memang tidak bisa dipindahkan.
 */
export function bacaBentrokSku(error: unknown): SkuConflict[] {
  if (!(error instanceof JsonResponseError)) return []
  const data = error.data
  if (typeof data !== "object" || data === null || !("bentrokSku" in data)) return []
  return Array.isArray(data.bentrokSku) ? (data.bentrokSku as SkuConflict[]) : []
}

/**
 * Tombol "Pindahkan SKU ke produk ini" di bawah pesan galat SKU bentrok.
 *
 * Ada supaya menukar SKU dua produk tidak perlu tiga kali simpan dengan satu
 * SKU dikosongkan di tengahnya (2 November 2026). Dengan tombol ini: ambil SKU
 * produk lain ke sini, lalu buka produk lain itu dan isi SKU lama produk ini —
 * yang kini sudah bebas.
 *
 * Dialognya menyebut setiap SKU dan pemegangnya, karena pemegang lama
 * kehilangan SKU-nya dan — kalau Kode Accurate-nya sama dengan SKU itu — juga
 * tautan Accurate-nya. Itu perubahan pada produk LAIN, jadi staff harus
 * melihatnya sebelum menyetujui.
 */
export function PindahSkuButton({
  bentrok,
  onPindahkan,
  disabled,
}: {
  bentrok: SkuConflict[]
  /** Kirim ulang simpanan yang sama dengan `ambil_alih_sku: true`. */
  onPindahkan: () => Promise<void>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (bentrok.length === 0) return null

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-2 w-full gap-1.5 border-destructive/40 bg-background text-destructive hover:bg-destructive/10 sm:w-auto"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
        Pindahkan SKU ke produk ini
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={bentrok.length === 1 ? "Pindahkan SKU ini ke produk ini?" : `Pindahkan ${bentrok.length} SKU ke produk ini?`}
        description={
          <span className="block space-y-2 text-left">
            <span className="block">SKU berikut dilepas dari pemegangnya sekarang lalu dipasang di sini:</span>
            <span className="block space-y-1.5">
              {bentrok.map((b) => (
                <span key={b.sku} className="block rounded-md bg-muted px-2.5 py-1.5 text-xs">
                  <span className="font-mono font-semibold text-foreground">{b.sku}</span>
                  {" — dari "}
                  {b.varian ? "varian" : "produk"} <span className="text-foreground">{b.pemilik}</span>
                  {b.kodeAccurateIkut && (
                    <span className="block text-muted-foreground">Kode Accurate-nya ikut pindah ke sini.</span>
                  )}
                </span>
              ))}
            </span>
            <span className="block text-xs">
              Pemegang lama jadi tanpa SKU. Kalau ingin menukar, buka produk itu lalu isi SKU lama produk ini.
              Kode Accurate produk ini yang sama dengan SKU lamanya ikut dilepas dan diganti kode yang baru.
            </span>
          </span>
        }
        confirmLabel="Pindahkan & simpan"
        onConfirm={onPindahkan}
      />
    </>
  )
}
