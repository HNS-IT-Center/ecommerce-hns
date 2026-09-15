"use client"

import { CalendarIcon, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Pemilih rentang tanggal & tombol unduh di kepala dashboard — belum berfungsi.
 *
 * Dipertahankan terlihat (bukan dihapus) supaya tempatnya sudah dikenal staff,
 * tapi dinonaktifkan dengan keterangan "segera hadir". Tombol yang tampak aktif
 * namun tak berbuat apa-apa saat ditekan terbaca seperti fitur yang rusak.
 *
 * Tooltip dipasang di pembungkus `<span>`, bukan di tombolnya: elemen
 * `disabled` tidak memancarkan event pointer, sehingga tooltip yang menempel
 * langsung padanya tidak pernah muncul.
 */
export function ComingSoonActions() {
  return (
    <TooltipProvider delay={150}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ComingSoon>
          <Button variant="outline" size="sm" disabled className="w-full justify-start sm:w-56">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Pilih rentang tanggal
          </Button>
        </ComingSoon>
        <ComingSoon>
          <Button size="sm" disabled className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </ComingSoon>
      </div>
    </TooltipProvider>
  )
}

function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span tabIndex={0} className="block cursor-not-allowed rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            {children}
          </span>
        }
      />
      <TooltipContent>Segera hadir</TooltipContent>
    </Tooltip>
  )
}
