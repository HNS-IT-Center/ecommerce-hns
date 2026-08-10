"use client"

import { useEffect, useRef } from "react"

/**
 * Tombol Back menutup lapisan yang sedang terbuka, bukan meninggalkan halaman.
 *
 * Di ponsel — terutama Android yang punya tombol Back tetap — menutup panel
 * dengan Back adalah gerakan refleks. Tanpa ini, membuka keranjang lalu menekan
 * Back akan melempar orang keluar dari halaman produk yang sedang dilihatnya,
 * dan keranjangnya tetap terbuka saat ia kembali.
 *
 * Cara kerjanya: saat lapisan dibuka, satu entri riwayat "boneka" didorong ke
 * tumpukan. Menekan Back akan memakan entri itu — halaman tidak berpindah,
 * `popstate` menyala, dan kita tutup lapisannya. Kalau lapisan ditutup lewat
 * cara lain (tombol X, klik latar, Escape), entri boneka tadi harus ditarik
 * kembali dengan `history.back()` supaya tidak menumpuk; tanpa itu orang harus
 * menekan Back dua kali untuk benar-benar mundur satu halaman.
 *
 * Pengecualiannya: kalau lapisan tertutup karena penggunanya BERPINDAH HALAMAN
 * dari dalam lapisan itu, entri boneka tidak boleh ditarik. Alamat saat ini
 * dibandingkan dengan alamat saat lapisan dibuka untuk mengenali keadaan itu.
 *
 * `URL` sengaja tidak diubah — panel yang terbuka bukan alamat tersendiri, dan
 * menuliskannya ke bilah alamat akan membuat tautan yang dibagikan mengarah ke
 * keadaan UI, bukan ke halaman.
 */
export function useBackToClose(isOpen: boolean, onClose: () => void) {
  // Disimpan di ref supaya efek di bawah tidak perlu ikut berubah tiap render
  // saat pemanggil mengoper fungsi baru — efeknya hanya boleh bereaksi pada
  // perubahan `isOpen`, bukan pada identitas fungsinya.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  /** Menandai bahwa entri boneka milik kita masih ada di tumpukan riwayat. */
  const pushedRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    // Alamat saat lapisan dibuka. Dipakai di pembersihan untuk membedakan dua
    // sebab penutupan yang menuntut perlakuan berlawanan — lihat di bawah.
    const openedAt = window.location.href

    window.history.pushState({ overlay: true }, "")
    pushedRef.current = true

    const handlePopState = () => {
      // Entri boneka sudah dimakan browser saat popstate menyala, jadi tidak
      // ada yang perlu ditarik lagi di pembersihan.
      pushedRef.current = false
      onCloseRef.current()
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)

      // Ditutup TANPA lewat tombol Back — bereskan entri boneka yang tertinggal.
      if (!pushedRef.current) return
      pushedRef.current = false

      // Menutup karena PINDAH HALAMAN — misalnya menekan tautan di dalam
      // sidebar admin. Halaman baru sudah didorong di ATAS entri boneka, jadi
      // boneka itu bukan lagi puncak tumpukan: `history.back()` di sini tidak
      // membereskan apa-apa, melainkan memundurkan orang ke halaman yang baru
      // saja ia tinggalkan. Entri boneka dibiarkan terkubur — satu entri
      // berlebih jauh lebih murah daripada navigasi yang dibatalkan sendiri.
      if (window.location.href !== openedAt) return

      window.history.back()
    }
  }, [isOpen])
}
