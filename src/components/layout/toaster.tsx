"use client"

import {
  ToastPortal,
  ToastViewport,
  ToastRoot,
  ToastContent,
  ToastTitle,
  ToastDescription,
  ToastClose,
  useToastManager,
} from "@/components/ui/toast"

import { usePathname } from "next/navigation"

/**
 * Kelas per varian toast.
 *
 * `success` sudah ada sebelumnya; nilainya dipindah ke sini apa adanya, tanpa
 * satu pun kelas berubah.
 *
 * `danger` untuk penolakan yang MENGHENTIKAN aksi — langkah wajib PC Builder
 * yang belum diisi, misalnya. Toast netral (abu-abu `bg-popover`) terbaca
 * seperti kabar biasa dan justru terlewat saat orang sedang bergegas menekan
 * Print; merah menyampaikan bahwa ada yang harus dikerjakan dulu, sebelum
 * kalimatnya sempat dibaca.
 *
 * Merahnya disamakan dengan tanda `*` di daftar langkah PC Builder
 * (`text-red-500`, lihat `dynamic-builder-view.tsx`) supaya penanda "wajib" di
 * dua tempat itu terbaca sebagai hal yang sama.
 */
const VARIANT_STYLES = {
  success: {
    root: "bg-green-600 text-white border-green-600 min-h-0",
    content: "p-3 py-2",
    title: "text-white text-sm",
    description: "text-white/90 text-xs",
    close: "text-white/80 hover:text-white top-2 right-2",
  },
  danger: {
    root: "bg-red-600 text-white border-red-600 min-h-0",
    content: "p-3 py-2",
    title: "text-white text-sm",
    description: "text-white/90 text-xs",
    close: "text-white/80 hover:text-white top-2 right-2",
  },
} as const

export function Toaster() {
  const { toasts } = useToastManager()
  const pathname = usePathname()
  const isBuildPc = pathname?.startsWith("/build-pc")
  // Panel admin menaruh notifikasi di kiri atas: sudut kanan bawah di sana
  // ditempati tombol WhatsApp mengambang dan dock mobile, yang menutupi toast
  // tepat saat aksi AI selesai.
  const isAdmin = pathname?.startsWith("/admin")

  const positionClassName = isAdmin
    ? "!top-4 !left-4 !right-auto !bottom-auto sm:!top-6 sm:!left-6 sm:!right-auto sm:!bottom-auto"
    : isBuildPc
      // Kanan atas. `!bottom-auto` wajib di semua breakpoint karena viewport
      // bawaan memasang `bottom-4 sm:bottom-6` — tanpa itu toast tetap
      // tertarik ke bawah di layar sm ke atas.
      // Di mobile posisinya diturunkan ke bawah bar pencarian mengambang
      // (judul step + kolom cari + tombol sort) supaya tidak menutupinya;
      // di desktop bar itu tidak ada, jadi cukup jarak di bawah header.
      ? "!top-[140px] !bottom-auto sm:!bottom-auto md:!top-24"
      : ""

  const viewportClassName = `no-print print:hidden ${positionClassName}`.trim()

  return (
    <ToastPortal>
      <ToastViewport className={viewportClassName}>
        {toasts.map((toast) => {
          // Varian dibawa lewat `data` (payload bebas milik base-ui), bukan
          // sebagai prop tingkat atas — base-ui tidak punya field `variant`,
          // jadi menaruhnya di sana dulu hanya bisa lolos typecheck dengan
          // `as any` di setiap pemanggil.
          //
          // Kelasnya diambil dari VARIANT_STYLES, bukan dirangkai lewat ternary
          // di tiap baris JSX seperti dulu: dengan dua varian berwarna, bentuk
          // lama berarti lima ternary yang harus diubah berbarengan setiap kali
          // ada varian baru.
          //
          // `: unknown` bukan hiasan. `toast.data` bertipe `any` di base-ui,
          // dan perbandingan `===` tidak mempersempit `any` — tanpa anotasi ini
          // pengindeksan VARIANT_STYLES di bawah gagal typecheck (TS7053).
          // Lewat `unknown`, kedua perbandingan di bawahnya menjadi type guard
          // yang sah, sesuai CLAUDE.md §2.4.
          const variant: unknown = toast.data?.variant
          const styles =
            variant === "success" || variant === "danger"
              ? VARIANT_STYLES[variant]
              : null
          return (
          <ToastRoot 
            key={toast.id} 
            toast={toast}
            className={styles?.root ?? ""}
          >
            <ToastContent className={styles?.content ?? ""}>
              <div className="flex min-w-0 flex-1 flex-col gap-0">
                <ToastTitle className={styles?.title ?? ""} />
                <ToastDescription className={styles?.description ?? ""} />
              </div>
              <ToastClose className={styles?.close ?? ""}>&times;</ToastClose>
            </ToastContent>
          </ToastRoot>
        )})}
      </ToastViewport>
    </ToastPortal>
  )
}
