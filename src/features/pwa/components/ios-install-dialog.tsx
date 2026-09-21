"use client"

import { Share, SquarePlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type IosInstallDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * iOS has no install prompt API — Apple only allows installing through the
 * Share sheet. The best we can do is show the steps.
 */
export function IosInstallDialog({ open, onOpenChange }: IosInstallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pasang Aplikasi HNS</DialogTitle>
          <DialogDescription>
            Buka HNS IT Center langsung dari layar utama iPhone atau iPad Anda.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <span>
              Ketuk tombol <strong>Bagikan</strong>{" "}
              <Share className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> di bilah
              browser.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <span>
              Gulir lalu pilih <strong>Tambahkan ke Layar Utama</strong>{" "}
              <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              3
            </span>
            <span>
              Ketuk <strong>Tambah</strong>. Ikon HNS akan muncul di layar utama.
            </span>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  )
}
