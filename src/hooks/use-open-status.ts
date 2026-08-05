"use client";

import { useEffect, useState } from "react";

import {
  getOpenStatus,
  type OpenStatus,
  type StoreHours,
} from "@/lib/utils/opening-hours";

/**
 * Status buka/tutup toko, dihitung SETELAH hidrasi.
 *
 * Nilainya bergantung pada "sekarang", jadi menghitungnya saat render server
 * menghasilkan HTML yang sudah usang begitu sampai di peramban — dan React
 * melaporkannya sebagai hydration mismatch. Lebih halus lagi: server produksi
 * berjalan di UTC sementara tokonya di WIB, jadi keduanya bisa berbeda hari,
 * bukan cuma berbeda menit.
 *
 * Sebelum hidrasi selesai, kembaliannya `null` — pemanggil menampilkan jam buka
 * biasa dan menahan lencananya. Itu disengaja: lebih baik lencananya muncul
 * sedikit terlambat daripada menampilkan "Buka" yang keliru selama sedetik.
 *
 * Diperbarui tiap menit supaya lencana tidak membeku di "Buka sampai 21.00" pada
 * halaman yang ditinggalkan terbuka melewati jam tutup.
 */
export function useOpenStatus(hours: readonly StoreHours[]): OpenStatus | null {
  const [status, setStatus] = useState<OpenStatus | null>(null);

  useEffect(() => {
    const hitung = () => setStatus(getOpenStatus(hours));
    hitung();

    /**
     * Interval saja tidak cukup. Peramban menahan timer di tab latar — sebagian
     * memperlambatnya sampai sekali per menit, sebagian menghentikannya sama
     * sekali saat laptop ditutup. Akibatnya laptop yang dibuka lagi tiga jam
     * kemudian masih menampilkan "Buka sampai 21.00" pada pukul 22.30.
     *
     * `visibilitychange` menutup celah itu: begitu tab kembali terlihat, statusnya
     * dihitung ulang sebelum orangnya sempat membaca yang basi.
     */
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") hitung();
    };

    const timer = window.setInterval(hitung, 60_000);
    document.addEventListener("visibilitychange", saatTerlihat);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, [hours]);

  return status;
}
