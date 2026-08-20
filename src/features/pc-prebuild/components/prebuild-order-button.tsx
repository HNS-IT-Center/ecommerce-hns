"use client"

import { useState } from "react"
import { MessageCircle, TriangleAlert } from "lucide-react"

import { prepareBuildWhatsApp } from "@/features/builder/actions-whatsapp"

/**
 * Sengaja dideklarasikan ulang, BUKAN diimpor dari `actions-whatsapp.ts`.
 *
 * Berkas itu bertanda `"use server"`, dan Turbopack memperlakukan setiap
 * export di dalamnya sebagai server action — termasuk `export type`. Build
 * produksi gagal dengan "Export ... doesn't exist in target module", dan
 * `tsc --noEmit` TIDAK menangkapnya. Pelajaran yang sama sudah ditulis di
 * `pc-builder/actions.ts`.
 */
type BuildLineInput = {
  productId: number
  quantity: number
  stepName: string
}

/**
 * Tombol "Pesan lewat WhatsApp" untuk satu paket PC Prebuild.
 *
 * Yang dikirim ke server HANYA id produk, jumlah, dan nama langkahnya — persis
 * seperti tombol serupa di wizard. Harganya dibaca ulang di server lewat
 * `priceCartFromCatalog`, jadi angka di pesan yang diterima CS tidak bisa
 * berasal dari mana pun selain katalog (CLAUDE.md §2.7).
 *
 * Ini bukan kehati-hatian berlebihan: rakitan PC adalah nilai terbesar di situs
 * ini, dan CS yang melayani puluhan chat sehari tidak menghafal harga ribuan
 * produk.
 */
export function PrebuildOrderButton({ items }: { items: BuildLineInput[] }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pesan() {
    setError(null)
    setPending(true)
    try {
      const hasil = await prepareBuildWhatsApp(items)
      if (!hasil.ok) {
        setError(
          hasil.reason === "no-store"
            ? "Nomor WhatsApp toko belum tersedia. Coba lagi nanti."
            : "Paket ini belum bisa dipesan — komponennya sedang tidak tersedia."
        )
        return
      }
      window.open(hasil.waUrl, "_blank", "noopener,noreferrer")
    } catch {
      setError("Gagal menyiapkan pesanan. Coba lagi.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pesan}
        disabled={pending || items.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <MessageCircle className="h-4 w-4" />
        {pending ? "Menyiapkan…" : "Pesan lewat WhatsApp"}
      </button>

      {error && (
        <p className="flex items-start gap-2 text-xs text-sale-red">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
