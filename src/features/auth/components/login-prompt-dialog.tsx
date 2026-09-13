"use client"

import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { UserPlus } from "lucide-react"

type LoginPromptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Ke mana pelanggan dikembalikan setelah masuk. Dioper apa adanya sebagai
   * `?next=`; `sanitizeNextPath` di sisi /login yang menyaringnya, jadi
   * pemanggil tidak perlu memvalidasi apa pun di sini.
   */
  nextPath: string
  /** Judulnya menyebut perbuatan yang tadi diminta, bukan "Silakan masuk". */
  title?: string
  description?: string
  /**
   * Tampilkan tautan "Daftar Akun Baru".
   *
   * Default `false`, dan itu disengaja: `/register` berada di balik sakelar
   * `REGISTER_MANUAL_ENABLED` (server-only) dan melempar ke `/login` saat
   * mati. Dialog ini komponen klien, jadi ia tidak bisa membaca sakelar itu
   * sendiri — pemanggil yang tahu keadaannya dari server yang menyalakannya.
   * Menyalakan tanpa dasar berarti menawarkan tombol yang berputar balik ke
   * halaman masuk.
   *
   * Halaman /login sendiri sudah memuat tautan daftar saat sakelarnya hidup,
   * jadi tidak ada jalan yang benar-benar tertutup meski ini dibiarkan mati.
   */
  showRegister?: boolean
}

/**
 * Dialog yang muncul saat sebuah perbuatan butuh akun, menggantikan lompatan
 * `window.location.href = "/login"` yang langsung.
 *
 * Alasannya bukan estetika. Di PC builder, lompatan itu terjadi saat pelanggan
 * menekan "Simpan Rakitan" — persis setelah ia menghabiskan waktu menyusun
 * belasan komponen. Halaman berpindah tanpa sepatah kata, dan yang tampil
 * adalah formulir login yang tidak pernah ia minta. Dialog ini menahan
 * halamannya: rakitan tetap di layar, dan pelanggan yang memilih "Nanti saja"
 * kembali ke pekerjaannya tanpa kehilangan apa pun.
 *
 * "Nanti saja" WAJIB ada. Akun di HNS hanya menambah kemampuan menyimpan
 * rakitan — memesan lewat WhatsApp, keranjang, dan seluruh builder tetap
 * terbuka tanpa akun (lihat catatan di `app/login/page.tsx`). Dialog tanpa
 * jalan keluar akan menyiratkan sebaliknya.
 *
 * Perhatikan bahwa dialog ini TIDAK menjanjikan apa pun soal harga. Akun tidak
 * membuka diskon, harga member, atau tingkatan apa pun — CLAUDE.md §2.7 — jadi
 * salinannya sengaja hanya menyebut "menyimpan rakitan".
 */
export function LoginPromptDialog({
  open,
  onOpenChange,
  nextPath,
  title = "Masuk untuk menyimpan",
  description = "Rakitan Anda tersimpan di akun, jadi bisa dibuka lagi dari perangkat mana pun. Membuat akun gratis dan hanya butuh beberapa detik.",
  showRegister = false,
}: LoginPromptDialogProps) {
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`
  /*
   * Tanpa `?next=` — BUKAN kelalaian. `/register` tidak membaca parameter itu
   * sama sekali (lihat `app/register/page.tsx`), dan alurnya memang berakhir
   * di /register/cek-email, bukan kembali ke halaman asal: akun baru harus
   * memverifikasi email dulu sebelum bisa dipakai masuk. Menambahkan `?next=`
   * di sini hanya akan menaruh janji yang tidak dibaca siapa pun di URL.
   */
  const registerHref = "/register"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/*
          Kolom, bukan baris: di mobile tiga tombol berdampingan membuat
          labelnya terpotong. `sm:flex-col` menahan DialogFooter yang bawaannya
          berubah jadi baris di layar lebar — urutan vertikal di sini memang
          disengaja, karena ketiganya tindakan setara yang dibaca berurutan.
        */}
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Link
            href={loginHref}
            className={buttonVariants({ className: "w-full" })}
          >
            Masuk
          </Link>
          {showRegister && (
            <Link
              href={registerHref}
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Daftar Akun Baru
            </Link>
          )}
          {/*
            Bukan sekadar "Batal". Menyebut bahwa rakitannya tidak hilang
            adalah inti dialog ini — itu yang membedakannya dari lompatan
            halaman yang digantikannya.
          */}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Nanti saja, lanjut merakit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
