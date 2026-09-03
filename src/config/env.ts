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

  // Google Sheet (CSV publish) berisi data barang Accurate — kode, nama,
  // kategori, brand, status, STOK (TIDAK ada harga; harga diisi manual oleh
  // role harga di admin). Tombol "Import Data" di /admin/harga-accurate
  // menyedot Sheet ini dan meng-upsert `accurate_products` di ecommerce_hns.
  // URL `/pub?...output=csv` bersifat publik. Opsional: tanpa ini, tombol
  // import menampilkan pesan "URL Sheet belum diatur".
  GOOGLE_SHEET_CSV_URL: z.string().url().optional(),

  // Peninggalan jalur lama (database `updatewoo` remote). Tidak dipakai lagi
  // sejak data Accurate diimpor ke ecommerce_hns sebagai tabel accurate_*.
  // Dibiarkan opsional supaya .env lama tidak gagal validasi.
  STOCK_UPDATEWOO_DATABASE_URL: z.string().min(1).optional(),

  // Admin panel — kunci penanda tangan cookie sesi. Opsional di skema ini
  // supaya storefront tetap jalan tanpanya; `lib/auth/session.ts` menjaganya
  // sendiri dan melempar dengan pesan jelas saat sesi benar-benar dibutuhkan.
  AUTH_SECRET: z.string().min(32).optional(),

  // Akun pelanggan — login Google (docs/09-google-oauth-setup.md). Opsional
  // dengan alasan yang sama seperti AUTH_SECRET: skema ini di-parse saat
  // modul dimuat, jadi menandainya wajib mematikan storefront di mesin mana
  // pun yang belum punya kredensial Google. `lib/auth/google.ts` yang
  // menjaganya sendiri saat endpoint /api/auth/google benar-benar dipanggil.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

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

  // SMTP — kirim email verifikasi akun & reset password pelanggan (daftar
  // manual, docs/09 §8 tidak mencakup ini karena awalnya cuma Google).
  // Opsional dengan alasan yang sama seperti AUTH_SECRET/GOOGLE_CLIENT_ID:
  // skema ini di-parse saat modul dimuat, menandainya wajib mematikan
  // seluruh storefront di mesin yang belum punya kredensial SMTP.
  // `lib/email/send.ts` yang menjaganya sendiri dan melempar pesan jelas
  // saat pengiriman benar-benar dipanggil.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  // Boleh email polos ("a@b.com") ATAU berformat "Nama <a@b.com>" (RFC 5322)
  // — makanya BUKAN z.string().email(), yang menolak bentuk kedua.
  // nodemailer menerima keduanya apa adanya.
  SMTP_FROM: z
    .string()
    .refine(
      (value) => z.string().email().safeParse(value).success || /^.+<[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>$/.test(value),
      "Harus berupa email (a@b.com) atau format \"Nama <a@b.com>\""
    )
    .optional(),
  // Alamat balasan pelanggan diarahkan ke sini (CS), BUKAN ke SMTP_USER
  // (developer.hns@gmail.com) yang cuma dipakai kirim, tidak dipantau untuk
  // balasan. Opsional — kalau kosong, replyTo tidak disetel dan balasan
  // default ke SMTP_FROM seperti biasa.
  EMAIL_REPLY_TO: z.string().email().optional(),

  // ---------------------------------------------------------------------
  // Sakelar pendaftaran manual (email+password).
  //
  // SENGAJA tanpa prefiks NEXT_PUBLIC_: nilainya hanya dibaca di sisi
  // server, jadi mengubahnya cukup restart proses Node — tidak perlu build
  // ulang. Kalau suatu saat tergoda memakainya di Client Component, jangan
  // tambahkan prefiksnya; pindahkan keputusannya ke server.
  //
  // Default-nya "false" (tertutup) supaya lingkungan yang tidak menyebutkan
  // variabel ini sama sekali tidak diam-diam membuka pendaftaran yang
  // emailnya belum tentu bisa terkirim. Menyalakannya harus disengaja.
  //
  // Google OAuth TIDAK terpengaruh sakelar ini — masuk pertama kali lewat
  // Google sekaligus mendaftarkan akun, dan jalur itu tidak butuh email
  // verifikasi.
  REGISTER_MANUAL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  // ---------------------------------------------------------------------
  // Sakelar pengantrean sinkronisasi ke WooCommerce.
  //
  // Mengendalikan apakah perubahan produk di admin ikut MENGANTRE job push.
  // Tidak mengirim apa pun — pengiriman dikerjakan worker terpisah nanti.
  //
  // Opsional dengan alasan yang sama seperti AUTH_SECRET dan SMTP_*: skema
  // ini di-parse saat modul dimuat, jadi menandainya wajib akan mematikan
  // storefront di mesin mana pun yang belum menyebutkan variabel ini.
  //
  // Default "false": memasang pipanya lebih dulu, kerannya dibuka belakangan
  // setelah worker benar-benar ada. Lingkungan yang tidak menyebut variabel
  // ini tidak diam-diam mulai mengantre job yang tak akan pernah diproses.
  SYNC_ENQUEUE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
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
  GOOGLE_SHEET_CSV_URL: process.env.GOOGLE_SHEET_CSV_URL,
  STOCK_UPDATEWOO_DATABASE_URL: process.env.STOCK_UPDATEWOO_DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  REGISTER_MANUAL_ENABLED: process.env.REGISTER_MANUAL_ENABLED,
  SYNC_ENQUEUE_ENABLED: process.env.SYNC_ENQUEUE_ENABLED,
});
