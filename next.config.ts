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
};

export default nextConfig;
