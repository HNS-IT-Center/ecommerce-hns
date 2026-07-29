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
      {
        protocol: 'https',
        hostname: 'media.hnsitcenter.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
