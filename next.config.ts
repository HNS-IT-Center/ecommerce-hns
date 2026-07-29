import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
    ],
  },
};

export default nextConfig;
