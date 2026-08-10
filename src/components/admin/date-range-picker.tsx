"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { addDays, format, startOfMonth, startOfToday, subDays } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * Pilihan rentang siap pakai. Menelusuri log hampir selalu berarti "hari ini"
 * atau "beberapa hari terakhir"; menyuruh orang mencari dua tanggal di
 * kalender untuk itu jauh lebih lambat daripada satu klik.
 */
const PRESETS: Array<{ label: string; build: () => DateRange }> = [
  {
    label: "Hari Ini",
    build: () => ({ from: startOfToday(), to: startOfToday() }),
  },
  {
    label: "7 Hari Terakhir",
    build: () => ({ from: subDays(startOfToday(), 6), to: startOfToday() }),
  },
  {
    label: "30 Hari Terakhir",
    build: () => ({ from: subDays(startOfToday(), 29), to: startOfToday() }),
  },
  {
    label: "Bulan Ini",
    build: () => ({ from: startOfMonth(startOfToday()), to: startOfToday() }),
  },
]

// `onChange` bawaan div dibuang: tanda tangannya menerima ChangeEvent dan akan
// beririsan dengan callback rentang tanggal di bawah kalau dibiarkan.
type Props = Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> & {
  /**
   * Rentang terpilih. Kalau diisi, komponen jadi terkendali dan pemanggil yang
   * memegang state — dipakai penyaring log yang menyimpan rentangnya di URL.
   * Kalau tidak diisi, komponen memakai state sendiri seperti sebelumnya.
   */
  value?: DateRange | undefined
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  /** Menampilkan tombol hapus saat ada rentang terpilih. */
  clearable?: boolean
}

export function CalendarDateRangePicker({
  className,
  value,
  onChange,
  placeholder = "Pilih tanggal",
  clearable = false,
  ...divProps
}: Props) {
  // State cadangan untuk pemakaian tanpa `value` — dashboard memakai bentuk ini
  // sebagai ringkasan periode dan tidak perlu ikut mengelola state-nya.
  const [internal, setInternal] = React.useState<DateRange | undefined>({
    from: new Date(2026, 0, 20),
    to: addDays(new Date(2026, 0, 20), 20),
  })

  const isControlled = onChange !== undefined
  const date = isControlled ? value : internal

  const setDate = (range: DateRange | undefined) => {
    if (isControlled) onChange(range)
    else setInternal(range)
  }

  return (
    <div className={cn("grid gap-2", className)} {...divProps}>
      <Popover>
        <PopoverTrigger
          id="date"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full sm:w-[260px] justify-start text-left font-normal",
            !date?.from && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd MMM yyyy", { locale: localeId })} -{" "}
                  {format(date.to, "dd MMM yyyy", { locale: localeId })}
                </>
              ) : (
                format(date.from, "dd MMM yyyy", { locale: localeId })
              )
            ) : (
              placeholder
            )}
          </span>
          {clearable && date?.from && (
            // `span`, bukan `button` — pemicunya sendiri sudah sebuah tombol,
            // dan tombol bersarang bukan HTML yang sah.
            <span
              role="button"
              tabIndex={0}
              aria-label="Hapus filter tanggal"
              className="ml-auto -mr-1 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onPointerDown={(e) => {
                // Popover membuka di pointerdown; tanpa ini kalendernya sempat
                // terbuka tepat setelah rentangnya dihapus.
                e.preventDefault()
                e.stopPropagation()
                setDate(undefined)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  e.stopPropagation()
                  setDate(undefined)
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDate(preset.build())}
                  className="rounded-md px-3 py-1.5 text-left text-xs font-medium whitespace-nowrap hover:bg-muted"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <Calendar
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              locale={localeId}
              // Log tidak mungkin berasal dari masa depan, jadi tanggal setelah
              // hari ini hanya jadi pilihan yang selalu mengosongkan tabel.
              disabled={{ after: startOfToday() }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
