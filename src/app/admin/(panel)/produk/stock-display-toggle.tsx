"use client"

import { useState, useTransition } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { useToastManager } from "@/components/ui/toast"
import type { StockDisplayMode } from "@/lib/api/stock-display"
import { updateStockDisplayModeAction } from "./actions"

type Props = {
  /** Mode yang tersimpan saat halaman dirender. */
  mode: StockDisplayMode
}

const OPTIONS: {
  value: StockDisplayMode
  label: string
  description: string
  Icon: typeof Eye
}[] = [
  {
    value: "actual",
    label: "Tampilkan Stok Habis",
    description:
      "Produk yang stoknya kosong tampil bertanda “Stok Habis” dan tidak bisa dimasukkan ke keranjang.",
    Icon: Eye,
  },
  {
    value: "always_available",
    label: "Sembunyikan Stok Habis",
    description:
      "Produk yang stoknya kosong tetap tampil di katalog, tapi tertulis “Tersedia” dan tetap bisa dipesan (indent).",
    Icon: EyeOff,
  },
]

/**
 * Sakelar tampilan stok untuk pelanggan.
 *
 * Nilainya dipegang optimis supaya pilihan langsung terlihat berpindah — server
 * action-nya menyegarkan seluruh layout storefront, jadi jawabannya tidak
 * secepat klik. Kalau action-nya gagal, nilainya dikembalikan ke yang tersimpan
 * dan alasannya ditampilkan; membiarkan tampilan berpindah setelah gagal akan
 * membuat staff mengira situsnya sudah berubah padahal tidak.
 */
export function StockDisplayToggle({ mode }: Props) {
  const [current, setCurrent] = useState<StockDisplayMode>(mode)
  const [isPending, startTransition] = useTransition()
  const toastManager = useToastManager()

  function handleChange(next: StockDisplayMode) {
    if (next === current || isPending) return

    const previous = current
    setCurrent(next)

    startTransition(async () => {
      const result = await updateStockDisplayModeAction(next)

      if (result.error) {
        setCurrent(previous)
        toastManager.add({
          title: "Gagal menyimpan",
          description: result.error,
          // Tanpa `data.variant`: Toaster hanya mengenal "success", dan varian
          // yang tidak dikenal tetap tampil dengan gaya netral bawaan.
        })
        return
      }

      toastManager.add({
        title: "Tampilan stok diperbarui",
        description:
          next === "always_available"
            ? "Produk yang stoknya kosong kini tampil sebagai tersedia untuk pelanggan."
            : "Produk yang stoknya kosong kini tampil sebagai habis untuk pelanggan.",
        data: { variant: "success" },
      })
    })
  }

  return (
    <fieldset
      className="rounded-xl border border-input bg-background p-3 sm:p-4"
      disabled={isPending}
    >
      <legend className="flex items-center gap-2 px-1 text-sm font-bold">
        Tampilan stok ke pelanggan
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </legend>

      <p className="mt-1 text-xs text-muted-foreground">
        Berlaku untuk seluruh katalog, PC Builder, dan PC Prebuild. Stok yang
        tersimpan di database tidak berubah — panel ini tetap menampilkan stok
        yang sebenarnya.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const checked = current === option.value
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                checked
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/40"
              } ${isPending ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="stock-display-mode"
                value={option.value}
                checked={checked}
                onChange={() => handleChange(option.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <option.Icon className="h-4 w-4 shrink-0" />
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
