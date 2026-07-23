import type { MetadataRoute } from "next";
import { env } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const isProductionDomain = env.NEXT_PUBLIC_SITE_URL.includes("hnsitcenter.id");

  if (!isProductionDomain) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin panel belum ada proteksi login (lihat PRE-DEPLOY-CHECKLIST.md) —
      // minimal jangan sampai ke-index/muncul di hasil pencarian.
      disallow: "/admin",
    },
  };
}
