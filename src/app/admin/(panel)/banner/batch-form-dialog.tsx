"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { toDateInputValue } from "@/lib/utils/banner"
// Hanya TIPE — lihat catatan di `banner-list.tsx`.
import type { BatchOption } from "@/lib/api/banner-batches"
import { createBannerBatch, updateBannerBatch } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type BatchFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` berarti membuat kampanye baru. */
  batch: BatchOption | null
  /** Dipanggil setelah simpan berhasil, dengan baris yang tersimpan. */
  onSaved: (batch: BatchOption) => void
}

/**
 * Formulir kampanye — dipakai dua tempat: tab "Batch Kampanye" (tambah &
 * sunting) dan dropdown di formulir banner ("Buat kampanye baru…").
 *
 * Keadaan isian dipasang dari prop `batch` saat komponen dibuat, jadi
 * pemanggil WAJIB memberi `key` yang berubah antara mode tambah dan sunting
 * (lihat pemakaiannya di `banner-manager.tsx`). Tanpa itu, membuka dialog
 * untuk kampanye lain akan menampilkan isian kampanye sebelumnya.
 */
export function BatchFormDialog({ open, onOpenChange, batch, onSaved }: BatchFormDialogProps) {
  const isEdit = batch !== null

  const [name, setName] = React.useState(batch?.name ?? "")
  const [isActive, setIsActive] = React.useState(batch?.isActive ?? true)
  const [startsAt, setStartsAt] = React.useState(toDateInputValue(batch?.startsAt))
  const [endsAt, setEndsAt] = React.useState(toDateInputValue(batch?.endsAt))

  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    /**
     * `stopPropagation` bukan hiasan. Dialog ini ikut dirender DI DALAM
     * `<form>` banner (lihat `banner-form.tsx`). Di DOM keduanya terpisah
     * karena dialog memakai portal, tapi React tetap mengalirkan event lewat
     * pohon KOMPONEN — tanpa baris ini, menyimpan kampanye juga memicu
     * `onSubmit` formulir banner, yang menyalakan status "sedang menyimpan"
     * dan mengunci tombol Simpan banner tanpa pernah ada yang menyalakannya
     * kembali.
     */
    event.stopPropagation()
    if (saving) return

    setSaving(true)
    setError(null)
    try {
      const values = { name, isActive, startsAt, endsAt }
      const result = isEdit
        ? await updateBannerBatch(batch.id, values)
        : await createBannerBatch(values)

      if (!result.success) {
        setError(result.error)
        return
      }

      onSaved(result.batch)
      onOpenChange(false)
    } catch {
      setError("Gagal menyimpan kampanye. Coba lagi.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Kampanye" : "Kampanye Baru"}</DialogTitle>
          <DialogDescription>
            Kampanye adalah induk beberapa banner sekaligus — mematikannya menyembunyikan
            seluruh anggotanya tanpa perlu mematikan satu per satu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="batch-name">Nama Kampanye</Label>
            <Input
              id="batch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="mis. Promo Agustus 2026"
              maxLength={150}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="batch-starts-at">Mulai (opsional)</Label>
              <Input
                id="batch-starts-at"
                type="date"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-ends-at">Berakhir (opsional)</Label>
              <Input
                id="batch-ends-at"
                type="date"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <Switch
              id="batch-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked)}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <Label htmlFor="batch-active" className="text-xs font-semibold">
                Kampanye aktif
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Banner anggotanya hanya tayang kalau kampanye ini aktif DAN sedang berada di
                dalam rentang tanggalnya. Kosongkan tanggal kalau kampanye berjalan terus.
              </p>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving || !name.trim()} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan Perubahan" : "Buat Kampanye"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
