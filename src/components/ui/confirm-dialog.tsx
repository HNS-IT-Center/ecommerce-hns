"use client"

import { useState, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

/**
 * Pertanyaan ya/tidak siap pakai — pengganti `window.confirm`.
 *
 * Dibuat terkendali (`open` + `onOpenChange`), BUKAN memakai pemicu sendiri,
 * karena sebagian besar kebutuhan di panel ini muncul dari kejadian yang bukan
 * klik tombol: penyadapan klik tautan pada penjaga perubahan belum tersimpan,
 * atau aksi yang dipilih dari menu. Pemicu bawaan hanya melayani kasus tombol,
 * dan kasus itu justru yang paling sedikit.
 *
 * PERHATIAN saat menggantikan `window.confirm`. Yang bawaan peramban bersifat
 * SINKRON: ia menghentikan seluruh eksekusi sampai dijawab, sehingga bisa
 * dipakai di tengah penangan kejadian untuk memutuskan `preventDefault()`.
 * Komponen ini tidak bisa begitu — ia dirender React, jadi jawabannya baru tiba
 * beberapa tick kemudian, saat kejadian aslinya sudah mati. Pola yang benar:
 * hentikan dulu kejadiannya tanpa syarat, simpan niatnya di state, tampilkan
 * dialog ini, lalu jalankan niat itu di `onConfirm`.
 *
 * `onConfirm` boleh `async`. Selama ia berjalan kedua tombol dikunci dan
 * labelnya berganti, supaya satu perbuatan tidak terkirim dua kali oleh klik
 * ganda — hal yang tidak pernah bisa dijaga `window.confirm`.
 */
type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pertanyaannya, bukan judul bab. Mis. "Tinggalkan halaman ini?" */
  title: ReactNode
  /** Penjelasan akibatnya. Kosongkan kalau judulnya sudah cukup. */
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /**
   * Nyalakan untuk perbuatan yang menghancurkan (hapus, buang perubahan).
   * Tombol setujunya jadi merah — isyarat visual sebelum dibaca.
   */
  destructive?: boolean
  /** Boleh async. Dialog menutup sendiri setelah ia selesai tanpa melempar. */
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [sedangJalan, setSedangJalan] = useState(false)

  async function tangani() {
    setSedangJalan(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      // Dikembalikan walau gagal supaya tombolnya bisa dicoba lagi. Dialognya
      // sengaja TIDAK ditutup saat `onConfirm` melempar — menutupnya akan
      // menyembunyikan kegagalan dan orangnya mengira perbuatannya berhasil.
      setSedangJalan(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" disabled={sedangJalan} />}
          >
            {cancelLabel}
          </AlertDialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={tangani}
            disabled={sedangJalan}
          >
            {sedangJalan ? "Memproses…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
