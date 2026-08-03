import { z } from "zod";

const EnvSchema = z.object({
  // WooCommerce (WAJIB)
  WOOCOMMERCE_URL: z.string().url(),
  WOOCOMMERCE_CONSUMER_KEY: z.string().min(1),
  WOOCOMMERCE_CONSUMER_SECRET: z.string().min(1),

  // Site (WAJIB)
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SITE_NAME: z.string().default("HNS IT Center"),

  // Revalidation webhook (WAJIB)
  REVALIDATE_SECRET: z.string().min(32),

  // WhatsApp CS (WAJIB)
  NEXT_PUBLIC_WHATSAPP_CS_NUMBER: z.string().min(1),

  // Image domain WordPress
  NEXT_PUBLIC_IMAGE_DOMAIN: z.string().min(1),

  // Admin panel — WordPress Application Password (upload gambar produk lewat
  // /wp-json/wp/v2/media). BEDA kredensial dari WOOCOMMERCE_CONSUMER_*.
  WORDPRESS_APP_USER: z.string().min(1).optional(),
  WORDPRESS_APP_PASSWORD: z.string().min(1).optional(),

  // Admin panel — database MariaDB (Hostinger) via Prisma. Data toko &
  // kebijakan/FAQ. Opsional supaya storefront utama tidak fail-fast kalau
  // admin belum dikonfigurasi.
  DATABASE_URL: z.string().min(1).optional(),

  // Admin panel — kunci penanda tangan cookie sesi. Opsional di skema ini
  // supaya storefront tetap jalan tanpanya; `lib/auth/session.ts` menjaganya
  // sendiri dan melempar dengan pesan jelas saat sesi benar-benar dibutuhkan.
  AUTH_SECRET: z.string().min(32).optional(),

  // AI API Keys
  GEMINI_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),

  // Cloudflare R2 — penyimpanan gambar produk. Opsional dengan alasan yang
  // sama seperti AUTH_SECRET di atas: skema ini di-parse saat modul dimuat,
  // jadi menandainya wajib akan mematikan SELURUH aplikasi (storefront ikut
  // mati, bukan cuma upload) di mesin manapun yang belum punya kredensialnya.
  // `lib/api/cloudflare/r2.ts` yang menjaganya sendiri dan melempar dengan
  // pesan jelas saat upload benar-benar dipanggil.
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  NEXT_PUBLIC_R2_PUBLIC_URL: z.string().url().optional(),
});

export const env = EnvSchema.parse({
  WOOCOMMERCE_URL: process.env.WOOCOMMERCE_URL,
  WOOCOMMERCE_CONSUMER_KEY: process.env.WOOCOMMERCE_CONSUMER_KEY,
  WOOCOMMERCE_CONSUMER_SECRET: process.env.WOOCOMMERCE_CONSUMER_SECRET,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
  NEXT_PUBLIC_WHATSAPP_CS_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
  NEXT_PUBLIC_IMAGE_DOMAIN: process.env.NEXT_PUBLIC_IMAGE_DOMAIN,
  WORDPRESS_APP_USER: process.env.WP_USERNAME || process.env.WORDPRESS_APP_USER,
  WORDPRESS_APP_PASSWORD: process.env.WP_APP_PASSWORD || process.env.WORDPRESS_APP_PASSWORD,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
});
