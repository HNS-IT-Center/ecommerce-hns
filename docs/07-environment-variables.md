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

Dipakai `lib/email/send.ts` untuk mengirim email verifikasi akun & reset password pelanggan yang daftar manual di `/register` (lihat §8 dokumen ini soal keputusan login email+password, dan `docs/09-google-oauth-setup.md` untuk jalur Google). Tersedia juga untuk kebutuhan lain nanti (booking service, notifikasi order).

**Produksi memakai SMTP Hostinger, mengirim sebagai `noreply@hnsitcenter.id`** (keputusan 13 Agustus 2026, menggantikan Gmail yang dipakai sejak 12 Agustus). Alasannya di bawah; konfigurasi Gmail lama dicatat di akhir bagian ini karena masih dipakai sebagian mesin pengembangan.

| Variable | Nilai produksi (Hostinger) |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `noreply@hnsitcenter.id` — alamat **lengkap**, bukan `noreply` saja |
| `SMTP_PASSWORD` | password **mailbox** yang dibuat di hPanel (Emails → Email Accounts), **BUKAN** password akun hPanel |
| `SMTP_FROM` | `"HNS IT Center <noreply@hnsitcenter.id>"` — alamatnya harus sama dengan `SMTP_USER` |
| `EMAIL_REPLY_TO` | opsional — alamat CS yang dipantau untuk balasan. Pakai domain `hnsitcenter.id`. **JANGAN `@hnsitcenter.co.id`** — domain itu tidak terdaftar, lihat catatan di bawah. |

**Tidak ada saklar SSL/TLS terpisah.** `lib/email/send.ts` menurunkannya dari nomor port: `secure: port === 465`. Port 465 terenkripsi sejak koneksi dibuka; 587 mulai polos lalu naik lewat STARTTLS. Keduanya terbukti hidup (`220 ESMTP`, diuji 3× berturut pada 13 Agustus 2026); 465 dipilih karena terenkripsi sejak detik pertama. `SMTP_PORT` boleh ditulis sebagai teks — skema env meng-coerce ke number.

**Mengubah `SMTP_*` cukup RESTART, tidak perlu build ulang.** Tiga alasannya: variabel ini tidak berprefiks `NEXT_PUBLIC_` sehingga tidak pernah di-inline ke bundle browser; `send.ts` diawali `import "server-only"`; dan `EnvSchema.parse(process.env…)` di `config/env.ts` berjalan saat modul dimuat, bukan saat build. Kontras dengan `NEXT_PUBLIC_SITE_URL` yang **dibekukan saat build** dan karenanya wajib build ulang — perbedaan ini sempat jadi sumber kebingungan. Tetap restart proses Node-nya di hPanel; menyimpan env saja tidak cukup.

**Kenapa Hostinger, bukan Gmail.** Gmail SMTP relay menimpa header `From` ke alamat akun yang login kalau diisi alamat lain yang belum terdaftar sebagai alias "Send mail as" terverifikasi. Artinya `noreply@hnsitcenter.id` **tidak bisa** dikirim lewat Gmail tanpa menyiapkan alias itu dulu. SMTP Hostinger tidak punya batasan tersebut, dan rekord SPF `hnsitcenter.id` **sudah** memuat `include:_spf.mail.hostinger.com` — jadi SPF PASS tanpa menambah satu rekord DNS pun, beda dengan penyedia transaksional yang butuh tiga rekord baru.

**Yang masih harus dibuktikan dengan email sungguhan:** apakah Hostinger mengizinkan relay SMTP dari luar jaringannya. Sebagian penyedia membatasi ke IP sendiri; aplikasi ini juga di Hostinger sehingga kemungkinan aman, tapi jangan diasumsikan. Kalau ditolak, rencana B adalah Resend.

**Verifikasi setelah env terisi — empat langkah berurutan, jangan dilompati:**

1. Jalankan `npx tsx scratch/kirim-email-uji.mts <alamat-tujuan>` — kirim ke **Gmail dan Outlook**, dua penilai spam berbeda. Harus masuk INBOX, bukan folder spam.
2. Di Gmail buka **"Show original"**, cari `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
   - SPF FAIL → alamat di `SMTP_FROM` bukan `@hnsitcenter.id`, atau IP pengirim di luar SPF
   - DKIM tidak ada → aktifkan di hPanel (Emails → domain → DKIM)
   - DKIM PASS tapi DMARC FAIL → domain DKIM tidak sejajar dengan domain `From`
3. Uji di [mail-tester.com](https://www.mail-tester.com) — target ≥ 9/10.
4. **Uji alur sungguhan, bukan email lepas:** daftar akun baru di storefront, pastikan email verifikasi masuk inbox, lalu **klik tautannya** dan pastikan mengarah ke domain produksi, BUKAN `localhost`. Ulangi untuk lupa-password. (Lihat §2.1 soal `NEXT_PUBLIC_SITE_URL` yang pernah salah di Hostinger.)

**Jangan:** menimpa rekord SPF `hnsitcenter.id` yang sudah ada — ia melayani email bisnis HNS; tambahkan `include:` baru kalau perlu, jangan ganti barisnya. Jangan menaikkan DMARC ke `p=quarantine` sebelum SPF+DKIM terbukti PASS.

<details>
<summary><b>Konfigurasi Gmail (lama, masih dipakai sebagian mesin dev)</b></summary>

Dipakai 12–13 Agustus 2026 supaya alur daftar/reset bisa diuji tanpa menunggu mailbox domain. Batasnya: `From` selalu ditimpa ke alamat Gmail yang login, jadi pelanggan menerima email dari alamat Gmail pribadi — itu alasan pindah ke Hostinger.

1. Aktifkan 2-Step Verification di akun Gmail HNS (myaccount.google.com/security) — App Password tidak bisa dibuat tanpa ini.
2. Buka [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), buat password baru untuk "Mail".
3. Salin **persis 16 karakter** yang muncul, **buang spasi pemisahnya** — itu `SMTP_PASSWORD`, **bukan** password login Gmail biasa.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=developer.hns@gmail.com
SMTP_PASSWORD=<App Password 16 karakter tanpa spasi>
SMTP_FROM="HNS IT Center <developer.hns@gmail.com>"
```

</details>

> **Domain `hnsitcenter.co.id` TIDAK TERDAFTAR.** Diperiksa lewat resolver publik
> (8.8.8.8) pada 13 Agustus 2026: `Non-existent domain`. Email ke alamat
> `@hnsitcenter.co.id` memantul dan tidak pernah sampai. Alamat itu masih tampil
> di footer, halaman `/contact`, dan JSON-LD Organization — ada task terpisah
> untuk membereskannya. Domain yang mail-nya aktif: **`hnsitcenter.id`**.

Nama tampilan boleh apa saja — cuma bagian alamat email di dalam `< >` yang harus sama dengan `SMTP_USER`. Format: `SMTP_FROM="HNS IT Center <noreply@hnsitcenter.id>"`.

**`EMAIL_REPLY_TO`** mengarahkan balasan pelanggan ke alamat yang benar-benar dipantau tim (CS), bukan ke `SMTP_USER` yang cuma dipakai untuk mengirim. Kalau kosong, balasan default ke `SMTP_FROM`.

Tanpa `SMTP_*` terisi, `/register` dan alur lupa-password membalas error yang jelas ("Pengiriman email belum dikonfigurasi...") — sisa aplikasi (termasuk login Google) tetap berjalan normal.

---

### 2.7 OPSIONAL — Admin Panel (Prisma + MariaDB)

| Variable | Deskripsi | Cara Dapatnya |
|---|---|---|
| `DATABASE_URL` | Connection string MariaDB (`mysql://user:password@host:3306/dbname`) | hPanel Hostinger → Databases → MySQL Databases |
| ~~`WORDPRESS_APP_USER`~~ | **USANG** — lihat catatan di bawah | — |
| ~~`WORDPRESS_APP_PASSWORD`~~ | **USANG** — lihat catatan di bawah | — |

> **Dua env WordPress di atas sudah tidak terpakai.** Dulu dipakai mengunggah
> foto produk lewat WordPress Media REST API (`/wp-json/wp/v2/media`), yang memang
> tidak menerima `WOOCOMMERCE_CONSUMER_KEY/SECRET` dan butuh Application Password
> tersendiri. Sejak upload pindah ke Cloudflare R2 (§2.10), satu-satunya
> pembacanya adalah `lib/api/wordpress/media.ts` — dan berkas itu sendiri sudah
> tidak diimpor siapa pun. Aman dikosongkan; hapus dari `.env` setelah `media.ts`
> benar-benar dibuang. Blog (`lib/api/wordpress/posts.ts`) **tidak** memakainya —
> ia membaca REST publik tanpa autentikasi.

**Setup database setelah `DATABASE_URL` diisi:**
```bash
npx prisma migrate deploy            # apply migrasi yang belum tercatat
npx prisma db seed                   # isi konten kebijakan/FAQ/toko yang sudah final
```

> **Jangan `prisma migrate dev` atau `prisma db push`.** Dua-duanya dilarang di
> repo ini — lihat [`docs/08-database-migrations.md`](./08-database-migrations.md).
> `migrate dev` butuh shadow database (user MariaDB Hostinger tidak punya izin
> `CREATE DATABASE`) dan menawarkan me-reset database kalau riwayat migrasi
> dianggap tidak cocok; menyetujuinya menghapus katalog produk beserta akun admin.

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

---

### 2.9 OPSIONAL — Akun Pelanggan (Google OAuth)

| Variable | Deskripsi | Cara Dapatnya |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth Client ID | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret | Dihasilkan bersamaan dengan Client ID |

Setup lengkap konsol Google Cloud (consent screen, scope, redirect URI): [`docs/09-google-oauth-setup.md`](./09-google-oauth-setup.md).

Catatan:

- **Terpisah total dari `AUTH_SECRET`/sesi admin.** Login pelanggan memakai cookie `hns_customer_session`, sesi admin memakai `hns_admin_session` — beda kunci, beda tabel (`customers` vs `users`), tidak boleh saling menimpa.
- Opsional di skema Zod supaya storefront tidak fail-fast di mesin yang belum punya kredensial Google; `lib/auth/google.ts` yang menjaganya sendiri dan melempar pesan jelas saat `/api/auth/google` benar-benar dipanggil.
- `GOOGLE_CLIENT_SECRET` **tidak boleh** diawali `NEXT_PUBLIC_` — sama seperti alasan `AUTH_SECRET`, itu akan membocorkannya ke bundel browser.
- Rancangan lengkap (kenapa bukan Auth.js, kenapa kunci identitas `googleSub` bukan email, dst) ada di `docs/09-google-oauth-setup.md` §8.

---

### 2.10 WAJIB untuk Admin Panel — Upload Foto Produk (Cloudflare R2)

Tanpa kelima variabel ini, tombol unggah foto di `/admin/produk` mati total —
tidak ada jalur cadangan sejak WordPress Media ditinggalkan (lihat catatan §2.7).

| Variable | Deskripsi | Cara Dapatnya |
|---|---|---|
| `R2_ACCOUNT_ID` | Account ID Cloudflare. Dipakai membentuk endpoint S3 `https://<account-id>.r2.cloudflarestorage.com` | Cloudflare Dashboard → R2 → **Account ID** di panel kanan |
| `R2_ACCESS_KEY_ID` | Access Key ID dari API token R2 | Cloudflare Dashboard → R2 → **Manage R2 API Tokens** → Create API Token, izin **Object Read & Write** |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key pasangan token di atas | Ditampilkan **sekali saja** saat token dibuat. Tidak bisa dilihat ulang — kalau hilang, buat token baru |
| `R2_BUCKET_NAME` | Nama bucket tujuan upload | Cloudflare Dashboard → R2 → nama bucket. Proyek ini: `ecommerce-hns` |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Base URL publik bucket, **tanpa** garis miring di akhir | R2 → bucket → Settings → Public Development URL, atau custom domain yang disambungkan ke bucket |

**Jalur uploadnya — satu-satunya, tidak bercabang:**

```
admin/produk/image-uploader.tsx
  └─ POST /api/admin/media          (app/api/admin/media/route.ts)
       └─ uploadMedia()             (lib/api/cloudflare/r2.ts)
            └─ PutObjectCommand     → bucket R2, key `products/<id>-<nama>`
```

**Kelimanya wajib bersamaan.** `readConfig()` di `r2.ts` memeriksa kelimanya lalu
melempar `R2UploadError` yang menyebut variabel mana yang kurang. Mengisi
sebagian tidak membuat upload jalan sebagian — ia gagal seluruhnya.

**Kenapa opsional di `config/env.ts` padahal wajib di sini?** Alasan yang sama
persis dengan SMTP (§2.6): skema Zod di-parse saat modul dimuat, jadi menandainya
`required` akan mematikan **seluruh aplikasi** — storefront ikut mati — di mesin
mana pun yang belum diberi bucket. Kegagalan harus berhenti di "foto tidak bisa
diunggah", bukan "situs tidak bisa dibuka". Kewajibannya ditegakkan saat upload
dicoba, bukan saat aplikasi boot.

**Empat env server-only cukup RESTART; `NEXT_PUBLIC_R2_PUBLIC_URL` wajib BUILD
ULANG.** Yang berprefiks `NEXT_PUBLIC_` di-inline ke bundle browser saat build —
mengubahnya di panel hosting lalu restart saja tidak mengubah apa pun. Perbedaan
ini sudah beberapa kali jadi sumber kebingungan; lihat §2.1 soal
`NEXT_PUBLIC_SITE_URL`.

**Domain publiknya wajib terdaftar di `next.config.ts`.** `next/image` menolak
host yang tidak ada di `remotePatterns`. Nilai yang dipakai sekarang
`https://media.hnsitcenter.com` sudah terdaftar di sana. Perhatikan domainnya
**`.com`**, berbeda dari `hnsitcenter.id` yang dipakai WooCommerce dan SMTP —
kalau `NEXT_PUBLIC_R2_PUBLIC_URL` diganti, `remotePatterns` **wajib** ikut
diperbarui dan aplikasi di-build ulang, atau semua foto produk berhenti tampil.

**ID gambar bersifat sintetis.** R2 tidak punya ID integer seperti WordPress Media
Library, jadi `uploadMedia()` membangkitkannya dari `Date.now() * 1000 + counter`.
Penghitung itu bukan hiasan: mengunggah beberapa foto sekaligus (`Promise.all`
dari form admin) bisa selesai pada milidetik yang sama, dan tanpa penghitung dua
unggahan mendapat ID — dan nama berkas — identik, yang menimpa berkas di R2 dan
membuat React melihat dua `key` yang sama.

---

### 2.11 OPSIONAL — Fitur AI di Panel Admin (Groq)

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

Sudah dipakai sejak fitur AI pertama di panel produk, tapi baru dicatat di sini
saat endpoint ketiga ditambahkan (24 Agustus 2026) — sebelumnya ia hanya hidup
di `.env.example` dan di `config/env.ts`.

**Opsional, dan gagalnya harus tetap sopan.** Tanpa kunci ini aplikasi jalan
normal; yang mati cuma tiga tombol AI di panel admin, dan masing-masing membalas
"GROQ_API_KEY is not configured" alih-alih melempar 500 tanpa penjelasan:

| Dipakai | Guna |
|---|---|
| `POST /api/admin/format-specs` | Merapikan tempelan spesifikasi jadi tabel |
| `POST /api/admin/generate-short-description` | Deskripsi singkat produk |
| `POST /api/admin/pc-prebuild-performance` | Analisis performa paket PC Prebuild |

**Bukan `NEXT_PUBLIC_*`.** Kunci ini memanggil API berbayar atas nama HNS;
membawanya ke browser berarti siapa pun bisa membacanya dari devtools dan
memakainya sendiri. Ketiga endpoint memanggil `requireAuth()` lebih dulu karena
alasan yang sama — keduanya di `/api`, di luar jangkauan proxy `/admin`.

Batas laju per menit (TPM) dijaga di
[`lib/api/groq/rate-limit.ts`](../src/lib/api/groq/rate-limit.ts); angkanya
mengikuti tier akun, jadi kalau tier dinaikkan, perbarui tabel di berkas itu.

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
