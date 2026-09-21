import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tanpa ini Next menelusuri direktori induk untuk menebak workspace root, dan
  // lockfile nyasar di luar repo (mis. di home directory) bisa terpilih. Dipatok
  // ke folder project supaya file tracing tidak ikut menyeret isi luar repo.
  turbopack: {
    root: __dirname,
  },
  images: {
    /**
     * Next 16 hanya melayani nilai `quality` yang terdaftar di sini — di luar
     * daftar ini permintaannya ditolak, bukan diturunkan diam-diam. 75 tetap
     * ada karena itu bawaan yang dipakai seluruh gambar produk; 90 khusus untuk
     * banner beranda, yang teksnya sudah dibakar ke dalam gambar dan paling
     * cepat rusak oleh WebP lossy (lihat hero-carousel.tsx).
     */
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "hnsitcenter.id",
      },
      // WordPress setelah cutover domain: `hnsitcenter.id` dilayani Next.js,
      // WordPress pindah ke subdomain ini dan tinggal melayani blog. Gambar
      // featured artikel (`source_url` dari /wp-json/wp/v2) ikut berpindah host,
      // jadi tanpa entri ini `next/image` menolaknya dengan 400. Entri
      // `hnsitcenter.id` di atas dipertahankan sampai cutover selesai, karena
      // blog di staging masih membaca dari sana.
      {
        protocol: "https",
        hostname: "wp.hnsitcenter.id",
        pathname: "/wp-content/uploads/**",
      },
      // Bucket R2. Dipasang lebih dulu supaya gambar bisa tampil begitu URL-nya
      // dipindahkan; host WordPress lama sengaja dipertahankan karena seluruh
      // 12.827 gambar masih berada di sana sampai pemindahan selesai.
      {
        protocol: "https",
        hostname: "media.hnsitcenter.com",
        pathname: "/**",
      },
      // Thumbnail video YouTube, dipakai sebagai poster slide video di galeri
      // produk (lihat `getVideoPosterUrl`). Dibatasi ke path thumbnail saja.
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },

  /**
   * Rute akun pelanggan pindah dari `/akun` ke `/profile` (merge 15 Agustus
   * 2026 dari branch development).
   *
   * Rute lamanya TIDAK dibiarkan mati 404. Tautan `/akun` sempat dibagikan
   * saat pengujian, dan alamat yang pernah dibuka tersimpan di riwayat &
   * autocomplete peramban — orang yang mengetik "akun" di bilah alamat akan
   * ditawari alamat lama itu berbulan-bulan ke depan.
   *
   * `permanent: true` (308, bukan 307) supaya peramban dan mesin telusur
   * mencatat perpindahannya, bukan menanyakan ulang setiap kali. Konsekuensinya
   * disengaja: 308 di-cache agresif oleh peramban, jadi alamat ini tidak boleh
   * dipakai ulang untuk hal lain di kemudian hari.
   *
   * `:path*` ikut membawa sub-rutenya — `/akun/rakitan/<id>` yang dibagikan
   * pelanggan mendarat di `/profile/rakitan/<id>`, bukan di halaman profil
   * kosong yang membuat orang mengira rakitannya hilang.
   *
   * `/account` TIDAK ada di sini: ia sudah punya `page.tsx` sendiri yang
   * me-redirect (peninggalan halaman akun pra-Sprint-1). Menambahkannya di sini
   * juga akan membuat dua mekanisme redirect untuk satu alamat.
   */
  async redirects() {
    return [
      {
        source: "/akun",
        destination: "/profile",
        permanent: true,
      },
      {
        source: "/akun/:path*",
        destination: "/profile/:path*",
        permanent: true,
      },
    ];
  },

  /**
   * Service worker PWA (lihat `docs/14-pwa.md`). `no-cache` wajib: browser
   * memeriksa pembaruan `sw.js` sendiri, dan kalau berkas ini ikut di-cache
   * oleh CDN/proxy, perbaikan service worker bisa tertahan berhari-hari di HP
   * pelanggan.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
