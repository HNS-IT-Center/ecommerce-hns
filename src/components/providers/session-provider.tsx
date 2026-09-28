"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { fetchSession } from "@/lib/api/session"
import type { CurrentCustomer } from "@/lib/auth/customer"

export type CustomerStatus =
  | { loading: true; customer: null }
  | { loading: false; customer: CurrentCustomer | null }

type SessionValue = CustomerStatus & {
  /**
   * Tanya ulang ke server sekarang juga.
   *
   * `paksa` untuk pemanggil yang BARU SAJA mengubah sesi (keluar). Permintaan
   * yang sedang berjalan saat itu bisa saja sudah terkirim sebelum cookie
   * dicabut; menumpang padanya berarti memercayai jawaban yang menggambarkan
   * keadaan sedetik yang lalu. Peristiwa biasa (tab kembali dilihat) tidak
   * memerlukannya — di sana menumpang justru yang diinginkan, karena `focus`
   * dan `visibilitychange` kerap menyala bersamaan untuk satu kejadian yang
   * sama.
   */
  refresh: (paksa?: boolean) => Promise<void>
  /** Beri tahu TAB LAIN bahwa sesi patut diperiksa ulang. */
  announce: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

/**
 * Nama saluran antar-tab. Satu untuk seluruh aplikasi — pesannya sendiri tidak
 * berisi apa pun (lihat `announce`).
 */
const CHANNEL = "hns-session"

/**
 * Status login untuk seluruh aplikasi, DENGAN kewajiban menyegarkan diri.
 *
 * Sebelum ini status login dibaca sekali saat komponen mount lalu disimpan di
 * `useState` dan tidak pernah ditanyakan lagi. Tiga keluhan yang terlihat
 * berbeda ternyata gejala dari satu hal itu:
 *
 * 1. **Keluar tidak terlihat sampai pindah halaman.** Menekan "Keluar" di
 *    beranda mencabut cookie lalu mengantar ke beranda — halaman yang SEDANG
 *    dibuka. Tidak ada komponen yang unmount, jadi nama pelanggan tetap
 *    terpampang di header walau sesinya sudah tidak ada.
 * 2. **Tab lain masih terlihat masuk.** Tidak ada satu pun jalur yang
 *    memberitahu tab sebelah.
 * 3. **Perubahan peran "harus relog".** Di luar panel admin tidak ada yang
 *    memantau izin, jadi menu "Verifikasi Rakitan" baru muncul setelah
 *    halaman dimuat ulang penuh — dan cara yang paling diketahui staff untuk
 *    memaksanya adalah keluar lalu masuk lagi.
 *
 * Karena itu yang dipasang bukan tiga tambalan, melainkan satu aturan: status
 * login ditanyakan ulang pada setiap momen di mana ia MUNGKIN sudah berubah —
 * saat tab kembali dilihat orang, saat halaman kembali dari bfcache, saat tab
 * lain memberi aba-aba, dan saat aplikasi sendiri baru saja mengubahnya.
 *
 * ## Yang TIDAK dilakukan
 *
 * Tidak ada polling berkala. Peristiwanya (keluar, peran diubah) terjadi
 * beberapa kali sehari, bukan per detik, dan situs toko dibuka ribuan
 * pengunjung — timer di sini berarti ribuan permintaan untuk menunggu sesuatu
 * yang hampir tidak pernah terjadi. Panel admin punya kebutuhan yang berbeda
 * dan pengawasnya sendiri (`PermissionWatcher`, polling 30 detik) karena di
 * sana peran memang berubah saat orangnya sedang bekerja.
 *
 * Status login juga tidak pernah dipakai untuk HARGA. Ia hanya menentukan nama
 * di header dan tautan mana yang tampil (CLAUDE.md §2.7).
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<CustomerStatus>({ loading: true, customer: null })

  /**
   * Sidik status yang terakhir diketahui, untuk memutuskan perlu tidaknya
   * `router.refresh()`. Disimpan di ref, bukan state: membandingkannya tidak
   * boleh ikut memicu render.
   */
  const sidikRef = useRef<string | null>(null)
  /** Permintaan yang sedang berjalan — `focus` dan `visibilitychange` kerap menyala bersamaan. */
  const berjalanRef = useRef<Promise<void> | null>(null)
  /** Path terkini untuk dibaca dari dalam callback tanpa memasang ulang listener. */
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  const refresh = useCallback(async (paksa = false) => {
    const sedangBerjalan = berjalanRef.current
    if (sedangBerjalan && !paksa) return sedangBerjalan

    const permintaan = (async () => {
      // Menunggu yang sedang berjalan sebelum bertanya lagi — bukan
      // membatalkannya. Dua jawaban yang datang bersamaan bisa tiba dalam
      // urutan terbalik, dan yang menang jadi soal keberuntungan.
      if (sedangBerjalan) await sedangBerjalan

      const snapshot = await fetchSession()
      // `null` = tidak berhasil bertanya, BUKAN "belum masuk". Yang lama
      // dipertahankan; lihat `fetchSession`.
      if (!snapshot) return

      setStatus({ loading: false, customer: snapshot.customer })

      const sidik = sidikStatus(snapshot.customer)
      const sebelumnya = sidikRef.current
      sidikRef.current = sidik

      // Pemuatan pertama: dari "belum tahu" ke status sebenarnya bukan
      // perubahan yang perlu ditindaklanjuti — halamannya memang baru saja
      // dirender server.
      if (sebelumnya === null || sebelumnya === sidik) return

      // Panel admin punya pengawasnya sendiri, dan pengawas itu memunculkan
      // toast lebih dulu supaya halaman tidak berkedip tanpa keterangan
      // (`PermissionWatcher`). Menyegarkan diam-diam dari sini akan mendahului
      // penjelasan itu.
      if (pathnameRef.current?.startsWith("/admin")) return

      // Komponen server ikut disegarkan: yang basi bukan cuma nama di header,
      // tapi juga halaman yang isinya bergantung izin (`/verify`,
      // `/profile/quotation`). Penjaganya tetap di server — refresh ini hanya
      // membuat halaman bertanya ulang.
      router.refresh()
    })()

    berjalanRef.current = permintaan
    try {
      await permintaan
    } finally {
      // Hanya kosongkan kalau yang tercatat masih MILIK panggilan ini. Sebuah
      // `refresh(true)` yang menyusul sudah menimpa catatannya, dan
      // mengosongkannya dari sini akan membuat permintaan yang masih berjalan
      // itu tidak terlihat oleh pemanggil berikutnya.
      if (berjalanRef.current === permintaan) berjalanRef.current = null
    }
  }, [router])

  const announce = useCallback(() => {
    if (typeof BroadcastChannel === "undefined") return
    const saluran = new BroadcastChannel(CHANNEL)
    // Pesannya kosong dan SENGAJA tidak berisi status login. Yang disiarkan
    // adalah "tanyakan ulang", bukan "kamu sudah keluar" — tab penerima
    // bertanya sendiri ke server, jadi aba-aba yang salah kirim pun tidak bisa
    // membuat tab lain salah menampilkan status.
    saluran.postMessage(1)
    saluran.close()
  }, [])

  useEffect(() => {
    void refresh()

    const saatTerlihat = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    /**
     * `pageshow` dengan `persisted`: halaman yang kembali lewat tombol Back
     * dipulihkan UTUH dari bfcache, lengkap dengan state React yang lama —
     * termasuk nama orang yang barusan keluar. Ini satu-satunya kejadian yang
     * tidak tertangkap `visibilitychange` maupun `focus`.
     */
    const saatKembaliDariBfcache = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh()
    }

    document.addEventListener("visibilitychange", saatTerlihat)
    window.addEventListener("focus", saatTerlihat)
    window.addEventListener("pageshow", saatKembaliDariBfcache)

    const saluran =
      typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL)
    // Peramban tanpa BroadcastChannel (Safari lawas) tidak kehilangan
    // perbaikannya, hanya kecepatannya: tab sebelah tetap menyusul saat orang
    // berpindah ke sana, lewat `visibilitychange`/`focus` di atas.
    if (saluran) saluran.onmessage = () => void refresh()

    return () => {
      document.removeEventListener("visibilitychange", saatTerlihat)
      window.removeEventListener("focus", saatTerlihat)
      window.removeEventListener("pageshow", saatKembaliDariBfcache)
      saluran?.close()
    }
  }, [refresh])

  return (
    <SessionContext.Provider value={{ ...status, refresh, announce }}>
      {children}
    </SessionContext.Provider>
  )
}

/**
 * Semua yang membedakan satu status login dari yang lain — identitasnya DAN
 * hal-hal yang diturunkan dari izin.
 *
 * `permissionVersion` ikut supaya perubahan peran terdeteksi walau orangnya
 * tetap orang yang sama; tanpa itu, staff yang baru diberi akses `/verify`
 * akan melihat menu lamanya sampai ia memuat ulang halaman sendiri.
 */
function sidikStatus(customer: CurrentCustomer | null): string {
  if (!customer) return "-"
  return [
    customer.id,
    customer.isAdmin ? "1" : "0",
    customer.canOpenPanel ? "1" : "0",
    customer.canVerify ? "1" : "0",
    customer.permissionVersion ?? "-",
  ].join("|")
}

/**
 * Status login pelanggan. Bentuknya tidak berubah dari hook lama yang dulu
 * tinggal di `hooks/use-customer.ts`, jadi pemakainya tidak perlu tahu bahwa
 * sumbernya kini dibagi bersama.
 *
 * `loading: true` sampai jawaban pertama datang. Pemanggil WAJIB
 * membedakannya dari "belum masuk": merender "Masuk" selama status belum
 * diketahui berarti memberi tahu orang yang sudah login bahwa ia belum.
 */
export function useCustomer(): CustomerStatus {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useCustomer harus dipakai di dalam <SessionProvider>")
  }
  return ctx.loading ? { loading: true, customer: null } : { loading: false, customer: ctx.customer }
}

/**
 * Untuk komponen yang MENGUBAH sesi (keluar, dan nanti masuk): setelah
 * servernya selesai, panggil `refresh()` supaya tab ini ikut berubah, lalu
 * `announce()` supaya tab lain menyusul.
 */
export function useSessionActions(): Pick<SessionValue, "refresh" | "announce"> {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSessionActions harus dipakai di dalam <SessionProvider>")
  }
  return { refresh: ctx.refresh, announce: ctx.announce }
}
