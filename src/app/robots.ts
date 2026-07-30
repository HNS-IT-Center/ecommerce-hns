import type { MetadataRoute } from "next";
import { env } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  // We allow crawling on all domains so Lighthouse and SEO tools can check the site.
  // In a strict staging environment you might want to block this, but for now we allow it.

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
