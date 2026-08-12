"use client"

import { useActionState, useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { deleteCustomer } from "./actions"
import { EMPTY_CUSTOMER_STATE, MIN_REASON_WORDS } from "./state"

type Props = {
  customer: {
    id: string
    email: string
    name: string
    savedBuildCount: number
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dipanggil setelah penghapusan berhasil, membawa keterangan hasilnya. */
  onDeleted: (message: string) => void
}

/**
 * Konfirmasi penghapusan akun pelanggan.
 *
 * Yang diketik ulang adalah EMAIL pelanggan, bukan kata seragam semacam
 * "HAPUS". Kata seragam cuma menguji ketelitian mengetik; mengetik email yang
 * benar memaksa staff memastikan ia sedang menghapus ORANG YANG TEPAT —
 * kekeliruan yang paling mungkin terjadi di sini bukan "tidak sengaja menekan
 * tombol", melainkan "menghapus baris yang salah dari daftar".
 *
 * Perbandingannya tidak peka huruf besar-kecil dan mengabaikan spasi di ujung:
 * staff biasanya menyalin dari percakapan CS, dan menolak "Budi@..." yang
 * sebenarnya sama persis cuma melatih orang menyalin-tempel tanpa membaca.
 */
export function DeleteCustomerDialog({ customer, open, onOpenChange, onDeleted }: Props) {
  const [state, formAction, pending] = useActionState(deleteCustomer, EMPTY_CUSTOMER_STATE)
  const [typedEmail, setTypedEmail] = useState("")
  const [reason, setReason] = useState("")

  const emailMatches = typedEmail.trim().toLowerCase() === customer.email.toLowerCase()
  const reasonWordCount = reason.trim().split(/\s+/).filter(Boolean).length
  const reasonEnough = reasonWordCount >= MIN_REASON_WORDS
  const canSubmit = emailMatches && reasonEnough && !pending

  /**
   * Kosongkan isian saat dialog berpindah ke pelanggan lain.
   *
   * Pakai pola "sesuaikan state saat render" (membandingkan prop dengan state
   * penanda), BUKAN `useEffect` + `setState`. Selain melanggar aturan lint
   * `set-state-in-effect` yang berlaku di repo ini, versi efek punya cacat
   * nyata: isian baru dikosongkan SETELAH render pertama, jadi ada satu bingkai
   * di mana email pelanggan sebelumnya masih terpampang di kotak konfirmasi
   * milik pelanggan yang baru — persis keadaan yang bisa membuat penghapusan
   * salah sasaran lolos.
   *
   * Lihat catatan React: https://react.dev/learn/you-might-not-need-an-effect
   */
  const [lastCustomerId, setLastCustomerId] = useState(customer.id)
  if (lastCustomerId !== customer.id) {
    setLastCustomerId(customer.id)
    setTypedEmail("")
    setReason("")
  }

  /**
   * Keberhasilan diteruskan ke induk lewat state penanda yang sama, bukan
   * efek: `state.success` cuma berubah sekali per pengiriman formulir, jadi
   * membandingkannya dengan nilai yang sudah dilaporkan sudah cukup.
   */
  const [reportedSuccess, setReportedSuccess] = useState<string | null>(null)
  if (state.success && state.success !== reportedSuccess) {
    setReportedSuccess(state.success)
    onDeleted(state.success)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <form action={formAction}>
          <input type="hidden" name="customerId" value={customer.id} />

          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Hapus akun ini permanen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Akun <strong className="font-semibold text-foreground">{customer.name}</strong>{" "}
              <span className="break-all">({customer.email})</span> akan dihapus{" "}
              <strong className="font-semibold text-foreground">selamanya</strong>. Tindakan ini
              tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/*
            Rincian dampak diletakkan DI LUAR AlertDialogDescription, bukan di
            dalamnya: komponen itu merender <p>, dan <ul>/<div> di dalam <p>
            adalah HTML tidak sah yang diam-diam diperbaiki peramban dengan cara
            berbeda-beda.
          */}
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-foreground">Yang ikut terhapus:</p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              <li>Data akun (email, nama, nomor HP)</li>
              <li>
                {customer.savedBuildCount > 0 ? (
                  <>
                    <strong className="font-semibold text-foreground">
                      {customer.savedBuildCount} rakitan tersimpan
                    </strong>{" "}
                    milik pelanggan ini
                  </>
                ) : (
                  "Tidak ada rakitan tersimpan"
                )}
              </li>
            </ul>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="confirmation" className="text-sm">
                Ketik email pelanggan untuk memastikan orangnya benar
              </Label>
              <p className="mt-1 mb-2 font-mono text-xs break-all text-muted-foreground">
                {customer.email}
              </p>
              <Input
                id="confirmation"
                name="confirmation"
                autoComplete="off"
                spellCheck={false}
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                placeholder="ketik email di atas"
                aria-invalid={typedEmail.length > 0 && !emailMatches}
                disabled={pending}
              />
              {typedEmail.length > 0 && !emailMatches && (
                <p className="mt-1 text-xs text-destructive">Email belum sama persis.</p>
              )}
            </div>

            <div>
              <Label htmlFor="reason" className="text-sm">
                Alasan penghapusan <span className="text-destructive">*</span>
              </Label>
              <p className="mt-1 mb-2 text-xs text-muted-foreground">
                Tercatat di log audit. Jangan tulis email atau nama pelanggan di sini — cukup
                alasannya, mis. &ldquo;permintaan hapus data via CS WhatsApp&rdquo;.
              </p>
              <Input
                id="reason"
                name="reason"
                autoComplete="off"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`minimal ${MIN_REASON_WORDS} kata`}
                aria-invalid={reason.length > 0 && !reasonEnough}
                disabled={pending}
              />
              {reason.length > 0 && !reasonEnough && (
                <p className="mt-1 text-xs text-destructive">
                  Minimal {MIN_REASON_WORDS} kata (sekarang {reasonWordCount}).
                </p>
              )}
            </div>

            {state.error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>

          <AlertDialogFooter className="mt-6 flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!canSubmit}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {pending ? "Menghapus…" : "Hapus permanen"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
