"use client"

import { useState, useTransition } from "react"
import { BadgeCheck, Loader2, Store } from "lucide-react"

import { useToastManager } from "@/components/ui/toast"
import type { FooterMode } from "@/lib/api/footer-mode"
import { updateFooterModeAction } from "./actions"

const OPTIONS: {
  value: FooterMode
  label: string
  description: string
  Icon: typeof Store
}[] = [
  {
    value: "identitas",
    label: "Footer Verifikasi",
    description:
      "Nama PT lalu “Alamat :”, “No Telepon :”, dan “Email :” dalam format yang diminta untuk verifikasi usaha.",
    Icon: BadgeCheck,
  },
  {
    value: "cabang",
    label: "Footer Normal",
    description:
      "Seperti sebelumnya: blok Kontak (WA & email) dan daftar cabang dari halaman ini, lengkap dengan tautan Maps.",
    Icon: Store,
  },
]

/**
 * Sakelar isi bawah footer (`lib/api/footer-mode.ts`).
 *
 * Komponen tersendiri, bukan `StockDisplayToggle` yang diberi props: yang itu
 * terikat ke action & izin halaman Produk, yang ini ke halaman Toko. Polanya
 * sengaja sama — nilai dipegang optimis, dikembalikan bila action gagal —
 * supaya staff yang memakai keduanya tidak perlu belajar dua perilaku.
 */
export function FooterModeToggle({ mode }: { mode: FooterMode }) {
  const [current, setCurrent] = useState<FooterMode>(mode)
  const [isPending, startTransition] = useTransition()
  const toastManager = useToastManager()

  function handleChange(next: FooterMode) {
    if (next === current || isPending) return

    const previous = current
    setCurrent(next)

    startTransition(async () => {
      const result = await updateFooterModeAction(next)

      if (result.error) {
        setCurrent(previous)
        toastManager.add({ title: "Gagal menyimpan", description: result.error })
        return
      }

      toastManager.add({
        title: "Footer diperbarui",
        description:
          next === "identitas"
            ? "Footer kini menampilkan blok Alamat / No Telepon / Email untuk verifikasi."
            : "Footer kembali menampilkan blok Kontak dan daftar cabang.",
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
        Tampilan footer situs
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </legend>

      <p className="mt-1 text-xs text-muted-foreground">
        Berlaku untuk bagian bawah footer di semua halaman. Bisa diganti bolak-balik kapan saja —
        tidak ada data toko yang berubah.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const checked = current === option.value
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                checked ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
              } ${isPending ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="footer-mode"
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
                <span className="mt-1 block text-xs text-muted-foreground">
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
