# 07 — Environment Variables

> Baca dokumen ini sebelum menambah integrasi baru atau mengubah konfigurasi environment.
> Semua env var **wajib** didaftarkan di `.env.example` dan file ini secara paralel.

---

## 1. Prinsip Umum

### 1.1 Aturan Prefix
- `NEXT_PUBLIC_*` → **DAPAT** dilihat browser (di-inline ke bundle client). Jangan taruh secret di sini.
- Tanpa prefix → **HANYA** tersedia di server (Server Component, Route Handler, Server Action).

### 1.2 Aturan Repo
- **JANGAN PERNAH** commit file `.env.local`, `.env.production`, atau file berisi secret asli.
- **WAJIB** commit `.env.example` dengan placeholder — jadi acuan struktur.
- Secret production disimpan di provider hosting (Vercel Environment Variables, Docker Secrets, dsb).

### 1.3 Validasi Env di Runtime
Buat file `src/config/env.ts` yang parse & validasi dengan Zod. Aplikasi **fail-fast** kalau env wajib tidak ada.

```typescript
// src/config/env.ts
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

  // Payment gateway (opsional di Fase 1 kalau checkout via WA)
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z.enum(["true", "false"]).default("false"),

  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().optional(),

  // Search (opsional, Fase 2)
  MEILISEARCH_HOST: z.string().url().optional(),
  MEILISEARCH_API_KEY: z.string().optional(),
  NEXT_PUBLIC_MEILISEARCH_HOST: z.string().url().optional(),
  NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY: z.string().optional(),

  // Analytics (opsional)
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_FB_PIXEL_ID: z.string().optional(),

  // Error tracking (opsional)
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Image domain WordPress (WAJIB kalau gambar produk dari WordPress uploads)
  NEXT_PUBLIC_IMAGE_DOMAIN: z.string().min(1),

  // Email SMTP (opsional, untuk service booking notif)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // Auth (JIKA pakai NextAuth / session sendiri)
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.string().url().optional(),
});

export const env = EnvSchema.parse(process.env);
```

---

## 2. Daftar Env Vars

### 2.1 WAJIB (Aplikasi Tidak Bisa Jalan Tanpa Ini)

| Variable | Deskripsi | Contoh | Cara Dapatnya |
|---|---|---|---|
| `WOOCOMMERCE_URL` | URL base WordPress/WooCommerce (tanpa `/wp-json`) | `https://hnsitcenter.id` | Domain WordPress kamu |
| `WOOCOMMERCE_CONSUMER_KEY` | API consumer key (Read/Write) | `ck_xxxxxxxxxxxxxxxxxxxxxxx` | wp-admin → WooCommerce → Settings → Advanced → REST API → Add Key |
| `WOOCOMMERCE_CONSUMER_SECRET` | API consumer secret | `cs_xxxxxxxxxxxxxxxxxxxxxxx` | Dihasilkan bersamaan dengan consumer key |
| `NEXT_PUBLIC_SITE_URL` | URL Next.js production | `https://hnsitcenter.id` (setelah go-live) | Domain final |
| `NEXT_PUBLIC_SITE_NAME` | Nama brand untuk metadata | `HNS IT Center` | Fix |
| `REVALIDATE_SECRET` | Shared secret untuk validasi webhook revalidation | 32+ karakter random | Generate: `openssl rand -hex 32` |
| `NEXT_PUBLIC_WHATSAPP_CS_NUMBER` | Nomor CS untuk tombol WA (format internasional tanpa `+`) | `6282169703377` | Nomor CS resmi HNS |
| `NEXT_PUBLIC_IMAGE_DOMAIN` | Hostname image WordPress (untuk next/image remotePatterns) | `hnsitcenter.id` | Domain WordPress |

**Cara buat WooCommerce API key:**
1. Login ke wp-admin.
2. WooCommerce → Settings → Advanced → REST API.
3. "Add key" → isi Description ("Next.js Frontend"), User (admin), Permissions ("Read/Write").
4. Klik "Generate API Key" → salin `Consumer key` & `Consumer secret` **sekali saja** (nanti tidak bisa dilihat lagi).

**Cara setup webhook revalidation di WooCommerce:**
1. WooCommerce → Settings → Advanced → Webhooks → Add webhook.
2. Name: `Next.js Product Revalidate`.
3. Status: Active.
4. Topic: `Product updated` (buat webhook terpisah untuk `Product created` & `Product deleted`).
5. Delivery URL: `https://yoursite.com/api/revalidate`.
6. Secret: nilai yang sama dengan `REVALIDATE_SECRET`.
7. API version: v3.

---

### 2.2 OPSIONAL — Payment Gateway

Fase 1 bisa go-live tanpa payment gateway (order via WhatsApp). Setelah checkout online aktif:

#### Midtrans (rekomendasi untuk UMKM Indonesia)
| Variable | Deskripsi | Cara Dapatnya |
|---|---|---|
| `MIDTRANS_SERVER_KEY` | Server key (rahasia) | Dashboard Midtrans → Settings → Access Keys |
| `MIDTRANS_CLIENT_KEY` | Client key (bisa dipakai di browser via `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`) | Sama dengan di atas |
| `MIDTRANS_IS_PRODUCTION` | `true` untuk live, `false` untuk sandbox | Manual |

Daftar Midtrans: [dashboard.midtrans.com](https://dashboard.midtrans.com). Ada mode sandbox untuk testing.

#### Xendit (alternatif)
| Variable | Deskripsi | Cara Dapatnya |
|---|---|---|
| `XENDIT_SECRET_KEY` | API secret key | Dashboard Xendit → Settings → API Keys |
| `XENDIT_WEBHOOK_TOKEN` | Token untuk verifikasi webhook | Dashboard Xendit → Settings → Webhooks |

---

### 2.3 OPSIONAL — Search Engine (Fase 2)

Aktifkan setelah katalog besar & butuh search cepat + faceted:

| Variable | Deskripsi | Public/Server |
|---|---|---|
| `MEILISEARCH_HOST` | URL instance Meilisearch | Server |
| `MEILISEARCH_API_KEY` | Master/admin API key (untuk indexing) | Server |
| `NEXT_PUBLIC_MEILISEARCH_HOST` | Sama dengan host, tapi dibutuhkan di client | Public |
| `NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY` | Search-only key (read-only, aman di browser) | Public |

**Deploy Meilisearch:** self-host di VPS (Docker) atau pakai Meilisearch Cloud.

**Alternatif:** Algolia (managed, mudah, tapi berbayar lebih cepat).

---

### 2.4 OPSIONAL — Analytics & Marketing

| Variable | Deskripsi | Cara Dapatnya |
|---|---|---|
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 Measurement ID | Google Analytics → Admin → Data Streams → Web |
| `NEXT_PUBLIC_FB_PIXEL_ID` | Facebook Pixel ID | Meta Business Suite → Events Manager |

---

### 2.5 OPSIONAL — Error Tracking

| Variable | Deskripsi |
|---|---|
| `SENTRY_DSN` | DSN untuk error server-side |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN untuk error client-side |

Cara: buat project di [sentry.io](https://sentry.io) → Settings → Client Keys.

---

### 2.6 OPSIONAL — Email (SMTP)

Dibutuhkan jika mengirim email booking service, notifikasi order, dll. Fase 1 bisa pakai email pribadi lewat SMTP Gmail; produksi sebaiknya pakai SendGrid/Postmark/Amazon SES.

| Variable | Contoh |
|---|---|
| `SMTP_HOST` | `smtp.sendgrid.net` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `apikey` |
| `SMTP_PASSWORD` | `SG.xxxxx` |
| `SMTP_FROM` | `noreply@hnsitcenter.id` |

---

### 2.7 OPSIONAL — Admin Panel (Prisma + MariaDB, WordPress Application Password)

| Variable | Deskripsi | Cara Dapatnya |
|---|---|---|
| `DATABASE_URL` | Connection string MariaDB (`mysql://user:password@host:3306/dbname`) | hPanel Hostinger → Databases → MySQL Databases |
| `WORDPRESS_APP_USER` | Username WordPress buat upload gambar produk | Akun admin wp-admin yang sama |
| `WORDPRESS_APP_PASSWORD` | Application Password (BEDA dari password login biasa) | wp-admin → Users → Profile → Application Passwords → Add New |

**Kenapa 2 kredensial WordPress berbeda?** `WOOCOMMERCE_CONSUMER_KEY/SECRET` cuma valid untuk `/wp-json/wc/v3/*` (data produk/kategori/order). Upload gambar produk lewat admin panel butuh WordPress Media REST API (`/wp-json/wp/v2/media`), yang tidak menerima consumer key/secret — endpoint ini butuh Application Password.

**Setup database setelah `DATABASE_URL` diisi:**
```bash
npx prisma migrate dev --name init   # bikin tabel + apply migrasi
npx prisma db seed                   # isi konten kebijakan/FAQ/toko yang sudah final
```

Storefront utama (halaman kebijakan/FAQ/toko publik) tetap jalan tanpa `DATABASE_URL` — fallback ke konten di `lib/constants/policy-content.ts`/`stores.ts`. Yang butuh `DATABASE_URL` cuma menu edit di `/admin`.

---

### 2.8 WAJIB untuk Admin Panel — Auth

| Variable | Deskripsi |
|---|---|
| `AUTH_SECRET` | Minimal 32 karakter. Kunci HMAC penanda tangan cookie sesi admin |

Generate:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Catatan:

- **Tanpa ini login admin tidak jalan.** `lib/auth/session.ts` melempar dengan pesan jelas saat sesi dibutuhkan tapi variabelnya kosong.
- Pakai nilai **berbeda** antara development dan produksi. Mengganti nilainya membatalkan seluruh sesi yang sedang berjalan — berguna kalau suatu saat perlu memaksa semua orang login ulang.
- `AUTH_URL` **tidak dipakai**. Sesi admin memakai cookie bertanda tangan sendiri (HMAC lewat Web Crypto), bukan Auth.js, jadi tidak ada URL callback yang perlu dikonfigurasi. Keputusan ini beserta alasannya ada di `notes/sprint-1-fondasi-keamanan.md`.
- Login **pelanggan** (`/login`, `/register`) belum tersentuh dan masih simulasi client-side — cakupan terpisah.

---

## 3. Setup Lokal (Developer Baru)

### Langkah
1. Copy template: `cp .env.example .env.local`.
2. Isi 8 variabel WAJIB (bagian 2.1).
3. Isi variabel opsional sesuai fitur yang sedang kamu kerjakan.
4. Jalankan `npm run dev`. Jika ada error `EnvSchema.parse(...)` — env belum lengkap.

### Testing Konfigurasi
Tambahkan script di `package.json`:
```json
{
  "scripts": {
    "env:check": "tsx src/config/env.ts && echo 'Env OK'"
  }
}
```

Jalankan `npm run env:check` untuk validasi tanpa harus start server.

---

## 4. Setup Production (Deployment)

### 4.1 Vercel
- Project Settings → Environment Variables → Add satu per satu.
- Pisahkan scope: `Production`, `Preview`, `Development`.
- **JANGAN** pakai key production di Preview (pakai sandbox/staging WooCommerce kalau ada).

### 4.2 VPS (Docker)
- Simpan di `.env` yang **tidak** di-commit.
- Atau pakai Docker secrets / systemd env files.
- File permission 600 (`chmod 600 .env`).

### 4.3 Rotasi Secret
- Ganti WooCommerce API key **minimal 6 bulan sekali** atau saat ada indikasi kompromi.
- Ganti `REVALIDATE_SECRET` saat webhook diubah.
- Simpan histori rotasi (tanggal + siapa yang rotate) di dokumen internal (bukan di repo).

---

## 5. Yang TIDAK Boleh Dilakukan

- ❌ Commit `.env.local` / `.env.production`.
- ❌ Taruh secret (consumer secret, payment secret) di `NEXT_PUBLIC_*`.
- ❌ Hardcode credential di kode ("`const key = 'ck_xxxx'`") — pasti kena review reject.
- ❌ Share credential lewat chat/email tanpa enkripsi. Pakai password manager tim (1Password, Bitwarden).
- ❌ Pakai credential production untuk development.

---

## 6. Checklist Menambah Env Var Baru

- [ ] Tambahkan ke `.env.example` dengan komentar & placeholder.
- [ ] Tambahkan ke schema Zod di `src/config/env.ts`.
- [ ] Tambahkan ke tabel di dokumen ini (bagian yang sesuai).
- [ ] Update `docs/07-environment-variables.md` (file ini).
- [ ] Jika `NEXT_PUBLIC_*`, pastikan tidak mengandung secret.
- [ ] Update deployment (Vercel/VPS).
- [ ] Beri tahu tim di channel dev.
