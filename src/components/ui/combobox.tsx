"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export type ComboboxOption = {
  id: number | string
  label: string
}

type ComboboxProps = {
  value: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  /** Ditampilkan di bawah daftar saat teks yang diketik tidak cocok dengan opsi manapun. */
  createHint?: (query: string) => string
  className?: string
  inputClassName?: string
  disabled?: boolean
}

const MAX_VISIBLE_OPTIONS = 30

/**
 * Input teks bebas dengan saran dari data yang sudah ada (mis. nama atribut,
 * nilainya, atau brand). Bukan `<select>` — nilai yang diketik tetap valid walau
 * tidak ada di daftar saran, karena backend meng-upsert nama baru begitu produk
 * disimpan (lihat `replaceProductRelations` & `resolveBrandId` di
 * lib/api/woocommerce/products.ts).
 *
 * Daftar sarannya dirender lewat portal ke `document.body`, bukan sebagai anak
 * yang diposisikan absolut. Sebabnya konkret: kartu tempat combobox ini dipakai
 * memakai `overflow-hidden` (lihat components/ui/card.tsx), yang memotong habis
 * dropdown sehingga saran atribut tidak pernah terlihat sama sekali. Portal
 * membuat daftarnya lepas dari rantai overflow induk manapun.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  createHint,
  className,
  inputClassName,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{ top: number; left: number; width: number } | null>(
    null
  )
  const anchorRef = React.useRef<HTMLDivElement>(null)

  const filtered = React.useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return options.slice(0, MAX_VISIBLE_OPTIONS)
    return options
      .filter((option) => option.label.toLowerCase().includes(query))
      .slice(0, MAX_VISIBLE_OPTIONS)
  }, [options, value])

  const exactMatch = options.some(
    (option) => option.label.toLowerCase() === value.trim().toLowerCase()
  )
  const showCreateHint = Boolean(value.trim()) && !exactMatch && Boolean(createHint)
  const isVisible = open && (filtered.length > 0 || showCreateHint)

  // Posisi dropdown mengikuti input. Dihitung ulang saat dibuka dan saat
  // halaman digulir/diubah ukurannya — karena elemennya berada di `body`,
  // ia tidak ikut bergerak sendiri bersama kartunya.
  React.useLayoutEffect(() => {
    if (!isVisible) return

    function updatePosition() {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width })
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
    <div ref={anchorRef} className={cn("relative", className)}>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        autoComplete="off"
        className={inputClassName}
      />

      {isVisible &&
        position &&
        createPortal(
          <div
            className="fixed z-[100] max-h-52 overflow-y-auto rounded-lg border border-input bg-popover p-1 shadow-lg"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {filtered.map((option) => {
              const isSelected = option.label.toLowerCase() === value.trim().toLowerCase()
              return (
                <button
                  key={option.id}
                  type="button"
                  // onMouseDown (bukan onClick) supaya pilihan terekam sebelum
                  // onBlur input menutup dropdown ini.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onValueChange(option.label)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs hover:bg-muted",
                    isSelected && "font-medium text-primary"
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </button>
              )
            })}
            {showCreateHint && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                {createHint?.(value.trim())}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
