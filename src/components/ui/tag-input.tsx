"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, X } from "lucide-react"

import type { ComboboxOption } from "@/components/ui/combobox"
import { cn } from "@/lib/utils"

type TagInputProps = {
  values: string[]
  onValuesChange: (values: string[]) => void
  /** Saran nilai yang sudah ada. Nilai baru tetap boleh diketik. */
  options?: ComboboxOption[]
  placeholder?: string
  createHint?: (query: string) => string
  disabled?: boolean
  /** Dipakai saat `disabled`, menjelaskan mengapa isian belum bisa diisi. */
  disabledHint?: string
  className?: string
}

const MAX_VISIBLE_OPTIONS = 200
// Sesuai `max-h-52` (13rem = 208px) pada dropdown + margin 4px terhadap field.
const DROPDOWN_MAX_HEIGHT = 212

/**
 * Isian banyak nilai berbentuk tag, dengan tag berada DI DALAM kotak isian.
 *
 * Dipakai untuk atribut spesifikasi yang sah punya lebih dari satu nilai —
 * mis. "Motherboard Size: ATX, Micro-ATX, Mini-ITX" pada casing yang muat
 * beberapa ukuran. Skema database sudah mendukungnya (satu baris
 * `product_attributes` per nilai).
 *
 * Bukan memakai `Combobox` sebagai anak: komponen itu merender `<Input>`-nya
 * sendiri dengan bingkai penuh, sehingga tag akan berada di luar kotak dan
 * terlihat seperti dua kontrol terpisah. Di sini bingkainya dipegang wadah ini,
 * dan yang di dalam hanyalah `<input>` telanjang yang melebar mengikuti sisa
 * ruang — bentuk yang lazim untuk isian tag.
 *
 * Daftar sarannya dirender lewat portal ke `document.body`, sama seperti
 * Combobox: kartu tempat isian ini dipakai memakai `overflow-hidden`, yang
 * akan memotong habis dropdown-nya.
 */
export function TagInput({
  values,
  onValuesChange,
  options = [],
  placeholder,
  createHint,
  disabled,
  disabledHint,
  className,
}: TagInputProps) {
  const [draft, setDraft] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{
    top?: number
    bottom?: number
    left: number
    width: number
  } | null>(null)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function addValue(raw: string) {
    const value = raw.trim()
    setDraft("")
    if (!value) return
    // Dibandingkan tanpa huruf besar/kecil supaya "ATX" dan "atx" tidak jadi
    // dua tag yang isinya sama.
    if (values.some((v) => v.trim().toLowerCase() === value.toLowerCase())) return
    onValuesChange([...values, value])
  }

  // Nilai yang sudah dipakai dikeluarkan dari saran — menawarkannya lagi hanya
  // menghasilkan tag kembar yang langsung ditolak.
  const filtered = React.useMemo(() => {
    const taken = new Set(values.map((v) => v.trim().toLowerCase()))
    const query = draft.trim().toLowerCase()
    return options
      .filter((o) => !taken.has(o.label.trim().toLowerCase()))
      .filter((o) => !query || o.label.toLowerCase().includes(query))
      .slice(0, MAX_VISIBLE_OPTIONS)
  }, [options, values, draft])

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === draft.trim().toLowerCase(),
  )
  const showCreateHint = Boolean(draft.trim()) && !exactMatch && Boolean(createHint)
  const isVisible = open && !disabled && (filtered.length > 0 || showCreateHint)

  React.useLayoutEffect(() => {
    if (!isVisible) return

    function updatePosition() {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return

      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      if (spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow) {
        setPosition({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width })
      } else {
        setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width })
      }
    }

    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [isVisible])

  return (
    <div className={className}>
      <div
        ref={anchorRef}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-text",
        )}
      >
        {values.map((value) => (
          <span
            key={value}
            className="group inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-neutral-800 dark:hover:bg-slate-700"
          >
            {value}
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                onValuesChange(values.filter((v) => v !== value))
              }}
              aria-label={`Hapus nilai ${value}`}
              className="rounded p-0.5 text-white transition-colors hover:bg-red-600 disabled:pointer-events-none"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : ""}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            // Teks yang sudah diketik ikut ditetapkan saat meninggalkan isian,
            // supaya admin tidak kehilangannya karena lupa menekan Enter.
            if (draft.trim()) addValue(draft)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Enter berarti "pakai nilai ini", bukan submit — submit tak
              // sengaja akan menyimpan produk yang belum selesai diisi.
              e.preventDefault()
              const first = filtered[0]
              addValue(first && !draft.trim() ? first.label : draft)
              return
            }
            // Backspace pada isian kosong menghapus tag terakhir — perilaku
            // yang diharapkan dari isian tag di mana pun.
            if (e.key === "Backspace" && !draft && values.length > 0) {
              onValuesChange(values.slice(0, -1))
            }
          }}
          autoComplete="off"
          className="min-w-24 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {disabled && disabledHint && (
        <p className="mt-1 text-[11px] text-muted-foreground">{disabledHint}</p>
      )}

      {isVisible &&
        position &&
        createPortal(
          <div
            className="fixed z-[100] max-h-52 overflow-y-auto rounded-lg border border-input bg-popover p-1 shadow-lg"
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
            }}
          >
            {filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                // onMouseDown (bukan onClick) supaya pilihan terekam sebelum
                // onBlur input menutup dropdown ini.
                onMouseDown={(e) => {
                  e.preventDefault()
                  addValue(option.label)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs hover:bg-muted"
              >
                <Check className="h-3.5 w-3.5 shrink-0 opacity-0" />
                {option.label}
              </button>
            ))}
            {showCreateHint && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                {createHint?.(draft.trim())}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
