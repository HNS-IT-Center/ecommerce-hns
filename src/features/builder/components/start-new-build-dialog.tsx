"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type StartNewBuildDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoggedIn: boolean
  /** Buka SaveBuildDialog. Rakitan TIDAK dikosongkan di sini — itu terjadi setelah simpan sukses, lihat `onSaveSucceeded` di dynamic-builder-view.tsx. */
  onSaveFirst: () => void
  /** Kosongkan rakitan tanpa menyimpan. */
  onDiscard: () => void
}

/**
 * Bukan `ConfirmDialog` biasa: untuk pelanggan yang sudah login, ada TIGA
 * jalan (Simpan Dulu / Mulai Tanpa Simpan / Batal), bukan dua. `ConfirmDialog`
 * sengaja tidak diubah untuk mendukung ini — komponen itu dipakai di banyak
 * tempat lain sebagai ya/tidak sederhana, dan menambah slot tombol ketiga di
 * sana untuk satu pemanggil ini saja hanya menambah kerumitan pada pemanggil
 * lain yang tidak membutuhkannya.
 *
 * Guest tetap dua tombol — tidak ada "Simpan Dulu" karena memang tidak bisa.
 */
export function StartNewBuildDialog({
  open,
  onOpenChange,
  isLoggedIn,
  onSaveFirst,
  onDiscard,
}: StartNewBuildDialogProps) {
  const [discarding, setDiscarding] = useState(false)

  const handleDiscard = () => {
    setDiscarding(true)
    onDiscard()
    setDiscarding(false)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mulai rakitan baru?</AlertDialogTitle>
          <AlertDialogDescription>
            {isLoggedIn
              ? "Rakitan yang sedang terbuka akan dikosongkan. Simpan dulu kalau tidak ingin kehilangannya."
              : "Rakitan yang sedang terbuka akan hilang dan tidak bisa dikembalikan."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-col sm:items-stretch">
          {isLoggedIn && (
            <Button
              onClick={() => {
                onOpenChange(false)
                onSaveFirst()
              }}
            >
              Simpan Dulu
            </Button>
          )}
          <Button variant="destructive" onClick={handleDiscard} disabled={discarding}>
            {isLoggedIn ? "Mulai Tanpa Simpan" : "Mulai Rakitan Baru"}
          </Button>
          <AlertDialogCancel>Batal</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
