"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TriangleAlert } from "lucide-react"

type SaveBuildDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => Promise<{ ok: boolean; error?: string }>
  onSaved: () => void
}

/**
 * Nama boleh dikosongkan — `saveBuildAction` di server yang mengisi fallback
 * "Rakitan {tanggal}", supaya aturan penamaan hanya hidup di satu tempat.
 */
export function SaveBuildDialog({ open, onOpenChange, onConfirm, onSaved }: SaveBuildDialogProps) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (saving) return
    setSaving(true)
    setError(null)

    const result = await onConfirm(name)

    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? "Gagal menyimpan rakitan.")
      return
    }

    setName("")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          onOpenChange(next)
          if (!next) setError(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simpan Rakitan</DialogTitle>
          <DialogDescription>
            Rakitan ini akan muncul di akun Anda. Harganya selalu mengikuti harga terbaru di katalog,
            bukan harga saat disimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="block text-xs font-semibold" htmlFor="build-name">
            Nama rakitan
          </label>
          <Input
            id="build-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: PC Gaming Budget"
            maxLength={120}
            autoFocus
          />
          {error && (
            <p className="flex items-start gap-2 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            Batal
          </button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
