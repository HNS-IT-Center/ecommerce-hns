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
  /**
   * Dipanggil hanya saat pilihan benar-benar DITETAPKAN — klik saran, tekan
   * Enter, atau meninggalkan input dengan teks terisi. Berbeda dari
   * `onValueChange` yang menyala di setiap ketikan.
   *
   * Pakai ini untuk aksi yang tidak boleh berulang per huruf. Tanpa pemisahan
   * ini, pemanggil yang "menambah sesuatu" di `onValueChange` akan menambah
   * satu entri untuk tiap huruf: mengetik "WARNA" menghasilkan W, WA, WAR,
   * WARN, WARNA.
   */
  onCommit?: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  /** Ditampilkan di bawah daftar saat teks yang diketik tidak cocok dengan opsi manapun. */
  createHint?: (query: string) => string
  className?: string
  inputClassName?: string
  disabled?: boolean
}

// Cukup untuk menampung seluruh master atribut (61 saat ini) tanpa memotong
// diam-diam. Sebelumnya 30, dan itu membuat separuh atribut yang ada di sistem
// tidak pernah muncul di daftar saran — terlihat seperti datanya hilang.
const MAX_VISIBLE_OPTIONS = 200
// Sesuai `max-h-52` (13rem = 208px) pada dropdown + margin 4px terhadap input.
const DROPDOWN_MAX_HEIGHT = 212

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
  onCommit,
  options,
  placeholder,
  createHint,
  className,
  inputClassName,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{
    top?: number
    bottom?: number
    left: number
    width: number
  } | null>(null)
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
  //
  // Dropdown default terbuka ke bawah, tapi kalau ruang di bawah lebih sempit
  // dari tinggi dropdown (mis. input ini ada di baris paling bawah form,
  // dekat batas viewport), ia dibalik ke atas supaya tidak terpotong.
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
    <div ref={anchorRef} className={cn("relative", className)}>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          // Teks yang sudah diketik ikut ditetapkan saat meninggalkan input,
          // supaya admin tidak kehilangan isian karena lupa menekan Enter.
          if (onCommit && value.trim()) onCommit(value.trim())
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return
          // Enter di dalam form ini berarti "pakai nilai ini", bukan submit —
          // submit tak sengaja akan menyimpan produk yang belum selesai diisi.
          e.preventDefault()
          const first = filtered[0]
          const chosen = first && !value.trim() ? first.label : value.trim()
          if (!chosen) return
          onValueChange(chosen)
          onCommit?.(chosen)
          setOpen(false)
        }}
        autoComplete="off"
        className={inputClassName}
      />

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
                    onCommit?.(option.label)
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
