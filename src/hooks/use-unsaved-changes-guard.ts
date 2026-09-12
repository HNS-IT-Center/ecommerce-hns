"use client";

import { useEffect } from "react";

/**
 * Peringatkan sebelum perubahan yang belum disimpan hilang.
 *
 * CAKUPANNYA TIDAK PENUH, dan itu bukan kelalaian — App Router tidak punya API
 * resmi untuk membatalkan navigasi internal yang sudah dimulai. Yang di bawah
 * ini adalah batas sejauh mana hal itu bisa dijaga tanpa menambal internal Next,
 * dan batasnya ditulis terang-terangan supaya tidak ada yang mengira panel ini
 * menjamin lebih dari yang sebenarnya:
 *
 *   TERJAGA
 *   - Muat ulang halaman, tutup tab, tutup jendela          → beforeunload
 *   - Mengetik alamat lain / pergi keluar situs             → beforeunload
 *   - Klik tautan internal, termasuk menu sidebar           → penyadapan klik
 *
 *   TIDAK TERJAGA
 *   - Tombol Back/Forward peramban di dalam aplikasi. Navigasi SPA tidak
 *     memicu `beforeunload`, dan `popstate` baru tiba SETELAH riwayatnya
 *     berpindah — membatalkannya butuh mendorong balik state, yang menghasilkan
 *     riwayat rusak dan kedipan halaman. Lebih jujur tidak menjanjikannya
 *     daripada memasang penjagaan yang gagal secara aneh.
 *   - `router.push()` yang dipanggil dari kode, bukan dari tautan.
 *
 * Catatan rencana sprint sempat menyebut tombol Back ikut terjaga oleh
 * `beforeunload`. Itu keliru: `beforeunload` hanya menyala saat dokumennya
 * benar-benar ditinggalkan, sedangkan Back di dalam aplikasi tidak melakukan
 * itu. Dikoreksi di sini supaya tidak ada yang mengandalkannya.
 */

export function useUnsavedChangesGuard(
  isDirty: boolean,
  /**
   * Dipanggil dengan tujuan navigasi saat klik tautan disadap. Pemanggil yang
   * memutuskan apa yang terjadi berikutnya — biasanya menampilkan dialog lalu
   * melanjutkan sendiri kalau disetujui.
   *
   * Ini sebabnya penyadapnya TIDAK lagi memakai `window.confirm`. Dialog bawaan
   * peramban sinkron, jadi ia bisa menjawab "lanjut atau tidak" di tengah
   * penanganan klik; dialog React tidak bisa. Polanya dibalik: kliknya SELALU
   * dibatalkan lebih dulu, tujuannya diserahkan ke sini, dan navigasinya
   * dijalankan ulang belakangan kalau memang disetujui.
   */
  onIntercept: (href: string) => void,
): void {
  useEffect(() => {
    // Tidak ada yang perlu dijaga selama belum ada perubahan. Keluar lebih awal
    // berarti nol pendengar yang menempel di dokumen pada keadaan normal.
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Sebagian peramban lama baru menampilkan dialognya kalau `returnValue`
      // diisi, bukan cukup `preventDefault()`.
      //
      // Teksnya TIDAK bisa ditentukan sendiri: peramban modern mengabaikan pesan
      // kustom dan selalu memakai kalimatnya sendiri. Jadi dialog inilah satu-
      // satunya yang tidak akan pernah memakai komponen dialog project ini.
      event.returnValue = "";
    }

    function handleClick(event: MouseEvent) {
      // Klik yang sudah dibatalkan penanganan lain bukan urusan kita.
      if (event.defaultPrevented) return;

      // Klik tengah, Ctrl/Cmd/Shift-klik membuka tab baru — halaman ini tetap
      // di tempatnya, jadi tidak ada yang bisa hilang.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const tujuan = new URL(anchor.href, window.location.href);

      // Tautan keluar situs sengaja dilewatkan: dokumennya memang akan
      // ditinggalkan, jadi `beforeunload` yang menanganinya. Menyadapnya di sini
      // berarti dua dialog berurutan untuk satu perbuatan.
      if (tujuan.origin !== window.location.origin) return;

      // Tautan ke halaman yang sedang dibuka tidak menghilangkan apa pun.
      if (
        tujuan.pathname === window.location.pathname &&
        tujuan.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      // `stopPropagation` diperlukan, bukan hiasan: penjagaan ini berjalan di
      // fase CAPTURE justru supaya bisa mendahului penangan <Link> milik Next.
      // Tanpa menghentikan penyebarannya, Next tetap menerima kliknya dan
      // navigasinya jalan walau orangnya belum menjawab dialognya.
      event.stopPropagation();

      onIntercept(`${tujuan.pathname}${tujuan.search}`);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty, onIntercept]);
}
