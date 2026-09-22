"use client"

import { useState, useTransition } from "react"
import { Check, Loader2, TriangleAlert } from "lucide-react"

import { MAX_SALES_DISPLAY_NAME } from "../akun/state"
import { setSalesDisplayNameAction } from "./actions"

type SalesRow = {
  id: string
  name: string
  email: string
  salesDisplayName: string | null
}

/**
 * Mengatur nama yang tercetak di PDF quotation untuk tiap Sales.
 *
 * Ada di sini SELAIN di /admin/akun karena keduanya menjawab kebutuhan berbeda:
 * sales mengatur namanya sendiri, dan owner membetulkannya untuk orang yang
 * sedang tidak di tempat atau belum paham panel. Satu kolom, dua pintu.
 *
 * Perubahan tidak berlaku surut — quotation menyimpan salinan nama saat terbit.
 */
export function SalesNames({ rows, bolehEdit }: { rows: SalesRow[]; bolehEdit: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada akun yang berperan Sales. Beri peran dengan izin{" "}
        <strong>Tercantum sebagai Sales</strong> di tab Peran, lalu tautkan ke akunnya di tab
        Admin.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {rows.map((row) => (
        <SalesNameRow key={row.id} row={row} bolehEdit={bolehEdit} />
      ))}
    </div>
  )
}

function SalesNameRow({ row, bolehEdit }: { row: SalesRow; bolehEdit: boolean }) {
  const [value, setValue] = useState(row.salesDisplayName ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  // Dibandingkan dengan nilai tersimpan, bukan dengan string kosong: tombol
  // simpan harus menyala juga saat seseorang MENGOSONGKAN kolom yang tadinya
  // terisi, karena mengosongkan adalah perubahan yang sah.
  const berubah = value.trim() !== (row.salesDisplayName ?? "")

  const simpan = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const hasil = await setSalesDisplayNameAction({ userId: row.id, displayName: value })
      if (hasil.ok) setSaved(true)
      else setError(hasil.error)
    })
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{row.name}</p>
        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
          disabled={!bolehEdit || pending}
          placeholder={row.name}
          maxLength={MAX_SALES_DISPLAY_NAME}
          aria-label={`Nama tampilan quotation untuk ${row.name}`}
          className="w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background disabled:opacity-60 sm:w-56"
        />

        {bolehEdit && (
          <button
            type="button"
            onClick={simpan}
            disabled={!berubah || pending}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved && !berubah ? <Check className="h-4 w-4" /> : null}
            {saved && !berubah ? "Tersimpan" : "Simpan"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive sm:basis-full">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
