"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PencilLine, TriangleAlert } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import WhatsappIcon from "@/components/icons/whatsapp-icon"
import { normalizePhone } from "@/features/stores/lib/maps"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"

import { updateQuotationCustomerAction } from "../actions"
import { buildFollowUpMessage } from "../lib/follow-up-message"
import { MIN_DIGIT_NOMOR } from "../lib/customer-edit"
import { QUOTE_ACTION_OUTLINE, QUOTE_ACTION_WHATSAPP } from "../lib/button-styles"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

type Props = {
  code: string
  revision: number
  customerName: string | null
  customerPhone: string | null
  internalNote: string | null
  /** Nama tampilan orang yang sedang membuka halaman — lihat `buildFollowUpMessage`. */
  salesName: string
  /** Total yang SUDAH diformat rupiah di server (CLAUDE.md §2.7). */
  totalText: string
  publicUrl: string | null
  /** Pemilik & belum terjual. Syarat yang sama ditegakkan ulang di server. */
  bisaSunting: boolean
}

/**
 * Dua tombol yang bekerja atas identitas pelanggan: Follow up via WhatsApp dan
 * Ubah Data Pelanggan. Satu komponen karena keduanya berbagi satu keadaan.
 *
 * **Tombol follow-up sekarang selalu ada, juga saat nomornya kosong.** Dulu ia
 * hilang diam-diam — dan tombol yang tidak muncul tidak menjelaskan apa pun:
 * sales mengira fiturnya rusak, bukan mengira ada data yang belum diisi.
 * Sekarang menekannya membuka dialog ini dengan kursor di kolom nomor, jadi
 * jalan keluarnya ada di tempat masalahnya ditemukan.
 *
 * Yang menilai "nomornya bisa dipakai" tetap sama seperti sebelumnya: jumlah
 * digit setelah normalisasi. Kolomnya teks bebas, dan staff bisa terlanjur
 * menyimpan "-" atau nomor telepon rumah; wa.me tetap membuka halaman untuk
 * nomor seperti itu, hanya isinya "nomor tidak valid" setelah aplikasinya
 * terbuka.
 */
export function QuotationCustomerActions({
  code,
  revision,
  customerName,
  customerPhone,
  internalNote,
  salesName,
  totalText,
  publicUrl,
  bisaSunting,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sorotNomor, setSorotNomor] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /**
   * Hasil aksinya ditangani DI SINI, bukan lewat `useActionState` + `useEffect`.
   *
   * Yang harus terjadi setelah tersimpan adalah menutup dialog dan menyegarkan
   * halaman — dua hal yang mengikuti satu PERBUATAN, bukan mengikuti perubahan
   * keadaan. Menuliskannya sebagai efek atas `state.ok` berarti dialog juga akan
   * menutup sendiri saat komponen kebetulan dirender ulang dengan state lama,
   * dan React memang menolaknya (`react-hooks/set-state-in-effect`).
   */
  const simpan = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const hasil = await updateQuotationCustomerAction(formData)
      if (hasil.error) {
        setError(hasil.error)
        return
      }
      setOpen(false)
      // Kartu Pelanggan, pesan follow-up, dan tautan publik semuanya membaca
      // nilai yang baru.
      router.refresh()
    })
  }

  const nomor = customerPhone ? normalizePhone(customerPhone) : ""
  const nomorSiap = nomor.length >= MIN_DIGIT_NOMOR

  const followUp = () => {
    if (!nomorSiap) {
      setSorotNomor(true)
      setOpen(true)
      return
    }

    const pesan = buildFollowUpMessage(
      { customerName, salesName, code, revision, totalText, publicUrl },
      new Date(),
    )
    // Dipanggil LANGSUNG di dalam gestur klik, tanpa `await` sebelumnya, jadi
    // tidak tersangkut popup blocker (docs/17 §11.5).
    window.open(buildWhatsAppUrl(nomor, pesan), "_blank", "noopener,noreferrer")
  }

  return (
    <>
      <button type="button" onClick={followUp} className={QUOTE_ACTION_WHATSAPP}>
        <WhatsappIcon size={16} />
        Follow up WA
      </button>

      {bisaSunting && (
        <button
          type="button"
          onClick={() => {
            setSorotNomor(false)
            setOpen(true)
          }}
          className={QUOTE_ACTION_OUTLINE}
        >
          <PencilLine className="h-4 w-4" />
          Ubah Data
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Data Pelanggan</DialogTitle>
            <DialogDescription>
              {sorotNomor
                ? "Nomor WhatsApp pelanggan belum diisi — isi dulu di sini, lalu tekan Follow up WA."
                : "Perbaikan di sini tidak menaikkan nomor revisi: yang berubah identitas pelanggannya, bukan isi rakitan atau harganya."}
            </DialogDescription>
          </DialogHeader>

          <form action={simpan} className="space-y-4">
            <input type="hidden" name="code" value={code} />

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="customerName">
                Nama Pelanggan
              </label>
              <input
                id="customerName"
                name="customerName"
                type="text"
                defaultValue={customerName ?? ""}
                maxLength={120}
                required
                autoFocus={!sorotNomor}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tercetak di PDF dan terbaca kasir saat pelanggan datang.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="customerPhone">
                Nomor WhatsApp
              </label>
              <input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                inputMode="tel"
                defaultValue={customerPhone ?? ""}
                maxLength={20}
                placeholder="08xxxxxxxxxx"
                autoFocus={sorotNomor}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tidak pernah tercetak di PDF dan tidak terlihat kasir.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="internalNote">
                Catatan Internal
              </label>
              <textarea
                id="internalNote"
                name="internalNote"
                rows={3}
                defaultValue={internalNote ?? ""}
                maxLength={500}
                placeholder="mis. masih banding harga, tunggu gajian"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Hanya untuk Anda dan admin. Tidak tercetak, tidak terlihat kasir maupun
                pelanggan.
              </p>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-input px-4 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
