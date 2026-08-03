"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type RupiahInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  /** Nilai mentah dalam bentuk angka (tanpa titik/prefix) — yang sebenarnya dikirim ke server. */
  value: string
  /** Dipanggil dengan angka mentah (tanpa titik/prefix) setiap kali pengguna mengetik. */
  onValueChange: (rawDigits: string) => void
}

function formatWithThousands(digits: string): string {
  if (!digits) return ""
  return new Intl.NumberFormat("id-ID").format(BigInt(digits))
}

function countDigitsBefore(value: string, position: number): number {
  let count = 0
  for (let i = 0; i < position && i < value.length; i += 1) {
    if (/\d/.test(value[i])) count += 1
  }
  return count
}

function positionAfterNDigits(value: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i])) {
      seen += 1
      if (seen === digitCount) return i + 1
    }
  }
  return value.length
}

/**
 * Input harga yang menampilkan pemisah ribuan ala Indonesia sambil mengetik
 * (1000000 -> 1.000.000), tapi menyimpan & mengirim nilai mentah tanpa titik.
 * Posisi kursor dijaga berdasarkan jumlah digit di depannya, bukan index
 * karakter mentah — supaya edit di tengah angka (bukan cuma di akhir) tidak
 * melompatkan kursor ke ujung setiap kali separator baru muncul/hilang.
 */
function RupiahInput({ value, onValueChange, className, ...props }: RupiahInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const formatted = formatWithThousands(value)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawInput = e.target.value
    const cursorPos = e.target.selectionStart ?? rawInput.length
    const digitsBeforeCursor = countDigitsBefore(rawInput, cursorPos)
    const nextDigits = rawInput.replace(/\D/g, "")

    onValueChange(nextDigits)

    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      const nextFormatted = formatWithThousands(nextDigits)
      const nextCursor = positionAfterNDigits(nextFormatted, digitsBeforeCursor)
      el.setSelectionRange(nextCursor, nextCursor)
    })
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm font-medium text-muted-foreground">
        Rp
      </span>
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={formatted}
        onChange={handleChange}
        // Inline style dipakai (bukan class Tailwind) supaya padding awal ini
        // selalu menang dibanding `px-2.5` bawaan <Input> — urutan cascade
        // class hasil merge tailwind-merge antara `px-*` fisik dan `ps-*`
        // logis tidak terjamin konsisten.
        style={{ paddingInlineStart: "2rem" }}
        className={cn(className)}
      />
    </div>
  )
}

export { RupiahInput }
