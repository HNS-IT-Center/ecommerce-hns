"use client"

import { useState } from "react"
import { Check, Copy, MapPin } from "lucide-react"

import type { FooterStore } from "@/lib/api/stores"
import { useToastManager } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Alamat toko fisik di footer.
 *
 * Dua aksi dipisah ke dua elemen, bukan ditumpuk di satu tautan lewat tombol
 * pengubah (mis. Ctrl+klik untuk salin). Ctrl+klik pada tautan sudah berarti
 * "buka di tab baru" bagi peramban, di Mac Ctrl+klik adalah klik kanan, dan di
 * HP tidak ada hover maupun Ctrl sama sekali — padahal alamat toko paling sering
 * dicari dari HP. Tombol salin yang terlihat bekerja sama di semua perangkat.
 *
 * Komponen klien tersendiri supaya `Footer` tetap server component — alasan yang
 * sama dengan `FooterPaymentMethods`. Datanya dibaca di server dan diteruskan
 * sebagai props.
 */
export function FooterStores({ stores }: { stores: FooterStore[] }) {
  const toastManager = useToastManager()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (stores.length === 0) return null

  // Yang disalin hanya alamatnya, tanpa nama toko: tujuan paling umum adalah
  // menempelkannya ke aplikasi ojek online atau peta, yang mencari berdasarkan
  // alamat dan justru bingung oleh awalan "HNS IT Center …".
  const handleCopy = async (store: FooterStore) => {
    try {
      await navigator.clipboard.writeText(store.address)
      setCopiedId(store.id)
      setTimeout(() => setCopiedId((id) => (id === store.id ? null : id)), 2000)
      toastManager.add({
        title: "Alamat disalin",
        description: store.name,
        data: { variant: "success" },
      })
    } catch {
      // Clipboard bisa ditolak izinnya (atau tidak ada di konteks non-HTTPS).
      // Alamatnya ikut di toast supaya masih bisa disalin manual — pola yang
      // sama dengan `bank-account-dialog.tsx`.
      toastManager.add({
        title: "Gagal menyalin otomatis",
        description: store.address,
        priority: "low",
        timeout: 6000,
      })
    }
  }

  return (
    <TooltipProvider delay={200}>
      <div className="mt-4 border-t border-white/15 pt-8">
        <h4 className="text-sm font-bold uppercase tracking-wider">Toko Kami</h4>
        <ul className="mt-4 grid gap-6 md:grid-cols-2 lg:gap-12">
          {stores.map((store) => {
            const copied = copiedId === store.id
            return (
              <li key={store.id} className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/70" aria-hidden />

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <a
                        href={store.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group min-w-0 flex-1 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      />
                    }
                  >
                    <span className="block font-semibold text-white group-hover:underline">
                      {store.name}
                    </span>
                    <span className="mt-1 block leading-relaxed text-white/70 transition-colors group-hover:text-white">
                      {store.address}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Buka di Google Maps</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => handleCopy(store)}
                        aria-label={`Salin alamat ${store.name}`}
                        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      />
                    }
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </TooltipTrigger>
                  <TooltipContent>{copied ? "Tersalin" : "Salin alamat"}</TooltipContent>
                </Tooltip>
              </li>
            )
          })}
        </ul>
      </div>
    </TooltipProvider>
  )
}
