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
  // Panel admin menaruh notifikasi di KIRI atas: sudut kanan di sana ditempati
  // tombol WhatsApp mengambang dan dock mobile.
  const isAdmin = pathname?.startsWith("/admin")

  /**
   * SATU ATURAN, tiga rute: toast selalu menggantung di bawah chrome atas yang
   * berlaku di rute itu.
   *
   * Sebelumnya hanya `/admin` dan `/build-pc` yang diposisikan, dan sisanya —
   * yaitu seluruh toko — memakai bawaan `bottom-4`. Di ponsel titik itu tepat
   * di belakang MobileDock (`fixed bottom-0`, tinggi 60px) dan bersebelahan
   * dengan tombol WhatsApp (`bottom-[90px]`), jadi "Ditambahkan ke keranjang"
   * muncul di balik tumpukan tombol. Sudut bawah kanan di ponsel sudah penuh;
   * sudut atas tidak, dan satu-satunya yang ada di sana adalah header.
   *
   * `bottom-auto` (beserta `sm:bottom-auto`) WAJIB ikut di setiap posisi:
   * viewport bawaannya `bottom-4 sm:bottom-6`, dan tanpa lawan yang setara
   * `tailwind-merge` tidak punya alasan membuangnya — toast akan tertarik ke
   * bawah lagi begitu layar mencapai `sm`. Hal yang sama berlaku untuk
   * `right-auto` di panel admin.
   */
  const positionClassName = isAdmin
    // 56px (`AdminMobileBar`, `h-14`) + 12px napas. Bilahnya `md:hidden`, jadi
    // dari `md` ke atas tidak ada yang perlu dihindari lagi.
    ? "top-[68px] bottom-auto left-4 right-auto sm:bottom-auto sm:left-6 sm:right-auto md:top-6"
    : isBuildPc
      // 140px = tinggi bilah mengambang `/build-pc` di ponsel (judul step +
      // kolom cari + tombol sort), diukur, bukan diturunkan dari satu kelas.
      // Di `md` ke atas bilah itu tidak ada dan yang tersisa cuma header toko.
      ? "top-[140px] bottom-auto sm:bottom-auto md:top-24"
      // 64px (`Header`, `h-16`) + 12px napas.
      : "top-[76px] bottom-auto sm:bottom-auto"

  /**
   * `z-[60]`, bukan `z-50` bawaan viewport.
   *
   * Header toko (`fixed top-0 z-50`) dan MobileDock (`fixed bottom-0 z-50`)
   * berada di angka yang SAMA dengan toast. Saat z-index seri, yang menang
   * adalah urutan DOM — dan toast di-portal ke `<body>`, jadi urutannya tidak
   * dijamin. Itulah sebabnya toast kadang tampil utuh dan kadang tertutup
   * header tanpa pola yang jelas. Satu angka di atas chrome menghapus
   * pertanyaannya.
   *
   * Tetap di BAWAH lapisan yang memang harus menutupi segalanya: laci
   * `/build-pc` (`z-[55]`) sengaja dilewati — ia lebih rendah — tapi dialog dan
   * lightbox galeri (`z-[100]`) tetap menang atas toast, dan itu benar: yang
   * sedang dibaca orang tidak boleh ditimpa kabar sekilas.
   */
  const viewportClassName = `no-print print:hidden z-[60] ${positionClassName}`.trim()

  /**
   * Toast TUMBUH KE BAWAH dari titik jangkarnya.
   *
   * `ToastViewport` adalah kotak setinggi NOL (isinya diposisikan absolut), dan
   * `ToastRoot` bawaannya `absolute inset-x-0 bottom-0` — tepi BAWAH toast yang
   * menempel di jangkar, lalu badannya memanjang KE ATAS. Itu benar selama
   * jangkarnya di bawah layar; sekarang ketiga rute berjangkar di ATAS, dan
   * perilaku lama berarti badan toast memanjang ke arah header — yaitu keluar
   * layar, persis gejala "kotak hijau yang terpotong" yang dulu dilaporkan di
   * panel admin.
   *
   * Karena itu jangkarnya dibalik untuk SEMUA rute, bukan cuma `/admin`: tepi
   * ATAS yang menempel, badannya memanjang ke bawah — ke arah ruang kosong.
   */
  //
  // `-translate-y-2` di keadaan awal ikut dibalik karena alasan yang sama:
  // animasi bawaan (`translate-y-2`) menggeser toast masuk DARI BAWAH, arah
  // yang hanya masuk akal untuk toast yang berjangkar di bawah layar. Sekarang
  // ia datang dari arah header, tempat asalnya yang sebenarnya.
  const rootPositionClassName = "top-0 bottom-auto data-starting-style:-translate-y-2"

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
            className={`${rootPositionClassName} ${styles?.root ?? ""}`.trim()}
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
