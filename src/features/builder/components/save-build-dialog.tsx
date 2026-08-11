"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { CheckCircle2, TriangleAlert } from "lucide-react"

type SaveBuildDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => Promise<{ ok: boolean; error?: string }>
  /**
   * Dipanggil sekali begitu simpan sukses, SEBELUM layar konfirmasi
   * ditampilkan. Opsional — pemanggil biasa (tombol Simpan di panel My
   * Build) tidak perlu ini, tombol "Lihat Rakitan Saya"/"Lanjut Mengedit"
   * tetap tampil apa adanya. Dipakai `StartNewBuildDialog` untuk
   * mengosongkan rakitan lama otomatis setelah tersimpan, supaya pelanggan
   * yang memilih "Simpan Dulu" tidak perlu menekan "Mulai Rakitan Baru"
   * sekali lagi untuk niat yang sama.
   */
  onSaved?: () => void
}

/**
 * Dua layar dalam satu dialog: form nama, lalu — setelah sukses — konfirmasi
 * dengan dua jalan. TIDAK ada redirect otomatis ke /akun setelah simpan;
 * orang yang baru menyimpan sering masih ingin lanjut mengedit atau memesan
 * lewat WhatsApp, jadi keputusan pindah halaman diserahkan ke pelanggan,
 * bukan dipaksa.
 *
 * Nama boleh dikosongkan — `saveBuildAction` di server yang mengisi fallback
 * "Rakitan {tanggal}", supaya aturan penamaan hanya hidup di satu tempat.
 */
export function SaveBuildDialog({ open, onOpenChange, onConfirm, onSaved }: SaveBuildDialogProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // `null` = masih di form. String = sukses, isinya nama yang tersimpan.
  const [savedName, setSavedName] = useState<string | null>(null)

  const reset = () => {
    setName("")
    setError(null)
    setSavedName(null)
  }

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

    setSavedName(name.trim() || "Rakitan Anda")
    onSaved?.()
  }

  const handleOpenChange = (next: boolean) => {
    if (saving) return
    onOpenChange(next)
    if (!next) reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {savedName ? (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-green/10">
                <CheckCircle2 className="h-6 w-6 text-brand-green" />
              </div>
              <DialogTitle className="text-center">Rakitan Tersimpan</DialogTitle>
              <DialogDescription className="text-center">
                &quot;{savedName}&quot; sudah tersimpan di akun Anda. Harganya akan mengikuti harga
                terbaru di katalog setiap kali Anda membukanya kembali.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="sm:flex-col sm:gap-2">
              <Button className="w-full" onClick={() => router.push("/akun")}>
                Lihat Rakitan Saya
              </Button>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Lanjut Mengedit
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Simpan Rakitan</DialogTitle>
              <DialogDescription>
                Rakitan ini akan muncul di akun Anda. Harganya selalu mengikuti harga terbaru di
                katalog, bukan harga saat disimpan.
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
                onClick={() => handleOpenChange(false)}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                Batal
              </button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
