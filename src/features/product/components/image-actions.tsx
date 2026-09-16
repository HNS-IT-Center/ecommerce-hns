"use client"

import { Check, Copy, Download, Loader2 } from "lucide-react"
import { useTopLoader } from "nextjs-toploader"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { useToastManager } from "@/components/ui/toast"
import {
  canCopyImageToClipboard,
  copyImageToClipboard,
} from "@/lib/services/image-clipboard"
import { cn } from "@/lib/utils"
import { resolveImageFileUrl } from "@/lib/utils/media-download"

/**
 * Kemampuan clipboard peramban tidak pernah berubah selama halaman hidup, jadi
 * tidak ada apa pun yang perlu dilanggani — `useSyncExternalStore` tetap butuh
 * fungsi berhenti-berlangganan, dan ini bentuk kosongnya. Di luar komponen
 * supaya acuannya tetap sama di setiap render.
 */
const subscribeToNothing = () => () => {}

interface ImageActionsProps {
  /** URL foto yang sedang tampil — bukan alamat `/_next/image`-nya. */
  src: string
  /** Nama produk; dipakai sebagai nama berkas unduhan. */
  fileBaseName?: string | null
  /** `dark` untuk di atas latar hitam (lightbox), `light` di atas kanvas foto. */
  tone?: "light" | "dark"
  className?: string
}

/**
 * Tombol "salin" dan "unduh" untuk foto yang sedang tampil di galeri produk.
 *
 * Ini menggantikan klik kanan → Copy/Save image, yang di kanvas galeri tidak
 * pernah sampai ke gambarnya: lapisan penangkap geseran (`z-[41]` di
 * `product-gallery.tsx`) menutupi seluruh kanvas, jadi menu peramban terbuka
 * di atas div kosong, bukan di atas `<img>`. Membongkar lapisan itu berarti
 * menyentuh ulang logika geseran yang riwayat bug-nya panjang — dan tombol
 * eksplisit juga lebih baik hasilnya: berkas aslinya yang turun (bukan WebP
 * hasil optimizer) dengan nama produk sebagai nama berkas, dan di ponsel
 * pembeli tidak perlu tahu soal tekan-lama.
 */
export function ImageActions({
  src,
  fileBaseName,
  tone = "light",
  className,
}: ImageActionsProps) {
  const toastManager = useToastManager()
  const topLoader = useTopLoader()
  const [copyState, setCopyState] = useState<"idle" | "copying" | "done">("idle")
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /*
   * Dukungan clipboard hanya ketahuan di peramban, jadi ia dibaca lewat
   * `useSyncExternalStore`: snapshot server selalu `false` (sama dengan HTML
   * yang dikirim), snapshot klien membaca kemampuan peramban yang sebenarnya.
   * Bentuk ini dipakai, bukan `useState` + `useEffect`, karena yang terakhir
   * berarti setState di dalam efek — dilarang `react-hooks/set-state-in-effect`
   * dan memang satu render ekstra untuk nilai yang tidak pernah berubah.
   */
  const canCopy = useSyncExternalStore(subscribeToNothing, canCopyImageToClipboard, () => false)

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  const fileUrl = resolveImageFileUrl(src, fileBaseName)

  // Host di luar daftar izin tidak bisa disalurkan; tombolnya tidak dilukis
  // daripada dilukis lalu gagal saat ditekan.
  if (!fileUrl) return null

  const handleCopy = async (event: React.MouseEvent) => {
    // Kanvas galeri membuka lightbox saat diklik, dan lightbox menutup diri
    // saat latarnya diklik. Keduanya tidak boleh ikut menyala dari sini.
    event.stopPropagation()
    if (copyState === "copying") return

    setCopyState("copying")
    try {
      await copyImageToClipboard(fileUrl)
      setCopyState("done")
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopyState("idle"), 2000)
      toastManager.add({
        title: "Gambar disalin",
        description: "Tempel di WhatsApp, Word, atau aplikasi lain.",
        priority: "low",
        timeout: 3000,
      })
    } catch {
      setCopyState("idle")
      // Izin clipboard bisa ditolak, dan gambarnya bisa gagal diambil. Dua-duanya
      // menyisakan satu jalan yang pasti ada: tombol unduh di sebelahnya.
      toastManager.add({
        title: "Gagal menyalin gambar",
        description: "Coba pakai tombol unduh di sebelahnya.",
        priority: "low",
        timeout: 5000,
      })
    }
  }

  /**
   * Unduhan bukan perpindahan halaman, jadi bilah biru di puncak layar
   * (`NextTopLoader` di `app/layout.tsx`) harus dihentikan sendiri di sini.
   *
   * Pustaka itu memasang satu pendengar klik di `document` dan menyalakan bilah
   * untuk SETIAP tautan same-origin yang ditekan; yang mematikannya adalah
   * perpindahan rute yang menyusul. Tautan unduhan tidak pernah memindahkan
   * rute — peramban menyimpan berkasnya dan halaman tetap di tempatnya — jadi
   * bilahnya merayap terus seolah ada yang masih dimuat. Daftar pengecualian
   * pustakanya hanya melihat protokol (`tel:`, `mailto:`, `blob:`, …), bukan
   * atribut `download`, jadi tautan ini tidak bisa dikecualikan di sana.
   *
   * `setTimeout` bukan hiasan: pendengar kita dan pendengar pustaka itu sama-
   * sama duduk di `document`, dan yang ini berjalan LEBIH DULU. Memanggil
   * `done()` langsung berarti dimatikan sebelum dinyalakan, dan bilahnya tetap
   * merayap. Menundanya satu putaran menaruhnya setelah `start()` milik
   * pustaka.
   */
  const handleDownload = (event: React.MouseEvent) => {
    event.stopPropagation()
    setTimeout(() => topLoader.done(), 0)
  }

  const buttonClass = cn(
    "flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-colors cursor-pointer disabled:cursor-default",
    tone === "dark"
      ? "bg-white/10 text-white hover:bg-white/20"
      : "bg-background/60 text-foreground shadow-sm hover:bg-background/90",
  )

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {canCopy && (
        <button
          type="button"
          onClick={handleCopy}
          disabled={copyState === "copying"}
          className={buttonClass}
          aria-label="Salin gambar"
          title="Salin gambar"
        >
          {copyState === "copying" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : copyState === "done" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      )}

      {/*
        Unduhan memakai tautan biasa, bukan `fetch` + blob: `<a download>` ke
        alamat same-origin sudah ditangani peramban sampai selesai — termasuk
        bilah unduhan dan lanjutan saat koneksi putus — dan tetap bekerja di
        ponsel. Nama berkasnya datang dari header `Content-Disposition` yang
        dipasang `/api/media/download`.
      */}
      <a
        href={fileUrl}
        download
        onClick={handleDownload}
        className={buttonClass}
        aria-label="Unduh gambar"
        title="Unduh gambar"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  )
}
