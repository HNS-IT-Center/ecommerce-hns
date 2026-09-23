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

/** `name` = nama yang BENAR-BENAR tersimpan, diisi server kalau kolomnya kosong. */
type SimpanResult = { ok: boolean; error?: string; name?: string }

type SaveBuildDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Simpan sebagai BARIS BARU. Selalu tersedia. */
  onConfirm: (name: string) => Promise<SimpanResult>
  /**
   * Timpa rakitan yang sedang diedit. Dipakai hanya kalau `editing` terisi.
   * `gone: true` berarti barisnya sudah tidak ada — dialognya lalu menutup
   * jalan "Simpan Perubahan" dan menyisakan "Simpan sebagai Rakitan Baru",
   * karena mencoba lagi tidak akan pernah berhasil.
   */
  onUpdate?: (name: string) => Promise<SimpanResult & { gone?: boolean }>
  /**
   * Rakitan tersimpan yang sedang dibuka di builder (`?build=<id>`), atau
   * `null` kalau ini rakitan yang belum pernah disimpan. Inilah yang
   * membedakan dialog dua tombol dari dialog satu tombol.
   */
  editing?: { id: string; name: string } | null
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
 * dengan dua jalan. TIDAK ada redirect otomatis ke /profile setelah simpan;
 * orang yang baru menyimpan sering masih ingin lanjut mengedit atau memesan
 * lewat WhatsApp, jadi keputusan pindah halaman diserahkan ke pelanggan,
 * bukan dipaksa.
 *
 * Saat `editing` terisi, formnya menawarkan DUA tombol: menimpa rakitan yang
 * sedang dibuka, atau menyimpannya sebagai rakitan baru. Sebelum ini hanya ada
 * satu jalan — selalu membuat baris baru — sehingga pelanggan yang membuka
 * rakitannya sendiri lewat "Lanjutkan di Builder", mengubah satu komponen,
 * lalu menekan Simpan justru menumpuk salinan, dan kuota 20 rakitan tersimpan
 * habis oleh rakitan yang itu-itu juga.
 *
 * Nama boleh dikosongkan — `saveBuildAction` di server yang mengisi fallback
 * "Rakitan {tanggal}", supaya aturan penamaan hanya hidup di satu tempat.
 */
export function SaveBuildDialog({
  open,
  onOpenChange,
  onConfirm,
  onUpdate,
  editing = null,
  onSaved,
}: SaveBuildDialogProps) {
  const router = useRouter()
  /**
   * `null` = belum disentuh pelanggan; yang tampil adalah nama rakitan yang
   * sedang diedit. Sengaja nilai turunan seperti ini, BUKAN `useEffect` yang
   * menyalin `editing.name` ke state saat dialog terbuka: efek semacam itu
   * ikut berjalan setiap kali `editing` berubah — termasuk tepat setelah
   * "Simpan sebagai Rakitan Baru" berhasil dan induknya memindahkan Mode Edit
   * ke baris yang baru lahir — dan menghapus layar konfirmasi yang baru saja
   * muncul.
   */
  const [name, setName] = useState<string | null>(null)
  // Tombol mana yang sedang menunggu server. `null` = tidak ada.
  const [saving, setSaving] = useState<"timpa" | "baru" | null>(null)
  const [error, setError] = useState<string | null>(null)
  // `null` = masih di form. Terisi = sukses, sekaligus menandai lewat jalan mana.
  const [savedMode, setSavedMode] = useState<"timpa" | "baru" | null>(null)
  const [savedName, setSavedName] = useState("")
  /** Rakitan asalnya sudah lenyap — lihat `onUpdate`. */
  const [asalHilang, setAsalHilang] = useState(false)

  const nilaiNama = name ?? editing?.name ?? ""
  const bolehMenimpa = !!editing && !!onUpdate && !asalHilang

  const reset = () => {
    setName(null)
    setError(null)
    setSavedMode(null)
    setSavedName("")
    setAsalHilang(false)
  }

  const handleSubmit = async (mode: "timpa" | "baru") => {
    if (saving) return
    setSaving(mode)
    setError(null)

    /*
     * `onConfirm`/`onUpdate` memanggil server action, dan server action bisa
     * MELEMPAR — bukan cuma mengembalikan `{ ok: false }`. Tanpa try/catch,
     * lemparan itu meninggalkan dialog pada keadaan "Menyimpan…" selamanya:
     * tombolnya terkunci, tidak ada pesan, dan tidak ada cara mencoba lagi
     * selain memuat ulang halaman.
     */
    let result: SimpanResult & { gone?: boolean }
    try {
      result =
        mode === "timpa" && onUpdate ? await onUpdate(nilaiNama) : await onConfirm(nilaiNama)
    } catch {
      setSaving(null)
      setError("Gagal menghubungi server. Periksa koneksi Anda lalu coba lagi.")
      return
    }

    setSaving(null)
    if (!result.ok) {
      /*
       * Rakitan asalnya sudah dihapus — bisa dari perangkat lain, bisa dari tab
       * sebelah. Menyuruh "coba lagi" di sini berarti menyuruh mencoba sesuatu
       * yang mustahil berhasil, sementara rakitan yang sedang disusun tetap
       * belum tersimpan di mana pun. Jalan menimpa ditutup, jalan simpan-baru
       * dibiarkan terbuka — dan itulah satu-satunya yang masih masuk akal.
       */
      if (result.gone) setAsalHilang(true)
      setError(result.error ?? "Gagal menyimpan rakitan.")
      return
    }

    // Nama yang dipakai layar konfirmasi datang dari SERVER kalau ada: kolom
    // nama yang dikosongkan diisi di sana ("Rakitan 23 September"), dan
    // menyebut nama lain di sini berarti pelanggan mencari rakitan dengan nama
    // yang tidak pernah ada di daftarnya.
    setSavedName(result.name ?? (nilaiNama.trim() || "Rakitan Anda"))
    setSavedMode(mode)

    /*
     * Rakitan sudah ada di database, tapi `/profile` yang akan dibuka
     * berikutnya masih bisa dilayani dari Router Cache peramban — salinan lama
     * yang belum memuat rakitan ini. Gejalanya: pelanggan menekan "Lihat
     * Rakitan Saya" dan mendarat di daftar yang tampak tidak berubah, seolah
     * simpannya gagal.
     *
     * `router.refresh()` dipanggil di sini, BUKAN setelah `router.push` di
     * bawah: penyegarannya sudah selesai sebelum halaman tujuan diminta,
     * sehingga daftarnya sudah baru pada saat pertama terlihat. Sisi server
     * menutup celah yang sama lewat `revalidatePath` di `actions-save.ts`.
     */
    router.refresh()
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
        {savedMode ? (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-green/10">
                <CheckCircle2 className="h-6 w-6 text-brand-green" />
              </div>
              <DialogTitle className="text-center">
                {savedMode === "timpa" ? "Perubahan Tersimpan" : "Rakitan Tersimpan"}
              </DialogTitle>
              <DialogDescription className="text-center">
                {savedMode === "timpa" ? (
                  <>
                    &quot;{savedName}&quot; sudah diperbarui — isinya diganti dengan rakitan yang
                    sekarang, bukan ditambahkan sebagai salinan baru.
                  </>
                ) : (
                  <>
                    &quot;{savedName}&quot; sudah tersimpan di akun Anda. Harganya akan mengikuti
                    harga terbaru di katalog setiap kali Anda membukanya kembali.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="sm:flex-col sm:gap-2">
              <Button className="w-full" onClick={() => router.push("/profile")}>
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
              <DialogTitle>{bolehMenimpa ? "Simpan Perubahan" : "Simpan Rakitan"}</DialogTitle>
              <DialogDescription>
                {bolehMenimpa && editing ? (
                  <>
                    Anda sedang mengedit &quot;{editing.name}&quot;. Perubahannya bisa ditimpakan ke
                    rakitan itu, atau disimpan sebagai rakitan baru tanpa mengubahnya.
                  </>
                ) : (
                  <>
                    Rakitan ini akan muncul di akun Anda. Harganya selalu mengikuti harga terbaru di
                    katalog, bukan harga saat disimpan.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label className="block text-xs font-semibold" htmlFor="build-name">
                Nama rakitan
              </label>
              <Input
                id="build-name"
                value={nilaiNama}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: PC Gaming Budget"
                maxLength={120}
                autoFocus
              />
              {bolehMenimpa && (
                <p className="text-xs text-muted-foreground">
                  Nama ini ikut tersimpan. Ubah dulu kalau Anda ingin menyimpannya sebagai rakitan
                  baru yang berdiri sendiri.
                </p>
              )}
              {error && (
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            {/* Saat sedang mengedit, tombolnya ditumpuk dan yang UTAMA adalah
                menimpa: itulah yang diharapkan orang yang membuka rakitannya
                sendiri lalu menekan Simpan. "Simpan sebagai Rakitan Baru" tetap
                satu ketukan, hanya tidak jadi bawaan — ia menambah baris dan
                memakan kuota rakitan tersimpan. */}
            <DialogFooter className={bolehMenimpa ? "sm:flex-col sm:gap-2" : undefined}>
              {bolehMenimpa ? (
                <>
                  <Button
                    className="w-full"
                    onClick={() => handleSubmit("timpa")}
                    disabled={!!saving}
                  >
                    {saving === "timpa" ? "Menyimpan…" : "Simpan Perubahan"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleSubmit("baru")}
                    disabled={!!saving}
                    className="w-full rounded-lg border border-input px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    {saving === "baru" ? "Menyimpan…" : "Simpan sebagai Rakitan Baru"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    disabled={!!saving}
                    className="w-full rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
                  >
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    disabled={!!saving}
                    className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <Button onClick={() => handleSubmit("baru")} disabled={!!saving}>
                    {saving === "baru" ? "Menyimpan…" : "Simpan"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
