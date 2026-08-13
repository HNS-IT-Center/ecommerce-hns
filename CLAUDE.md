# CLAUDE.md — Panduan Utama AI Agent untuk Project HNS IT Center

> **File ini WAJIB dibaca sepenuhnya sebelum melakukan tindakan apapun di dalam project ini.**
> File ini adalah "konstitusi" project. Semua aturan lain di folder `docs/` adalah turunan dari file ini.

> **Berkas ini ikut git dan hanya boleh ada SATU.** Sampai 7 Agustus 2026 ia di-gitignore,
> dan akibatnya dua salinan berbeda hidup di dua laptop tanpa pernah bertemu: satu memuat
> §2.2 versi Prisma dan §2.7 soal harga, satunya masih mewajibkan WooCommerce REST API dan
> tidak punya §2.7 sama sekali. Salinan kedua itulah yang dibaca agent saat insiden
> `db push` — agent-nya memang tidak pernah diberi tahu. Aturan yang hanya ada di satu
> laptop bukan aturan. Jangan pernah menambahkan berkas ini ke `.gitignore` lagi.

---

## 1. Tentang Project Ini

Project ini adalah **rebuild** dari website e-commerce **HNS IT Center Batam** (hnsitcenter.id) menggunakan **Next.js (App Router)**.

Website lama berjalan di WordPress + WooCommerce dengan ribuan produk. Rebuild ini bertujuan:

- Meningkatkan performa, SEO, dan pengalaman pengguna.
- Menggantikan frontend WordPress dengan Next.js modern.
- **Update 2026-07-25:** rencana awal "WooCommerce tetap backend data" sudah digantikan — lihat §2.2. Data produk sekarang tersimpan & dikelola di **Prisma DB** sendiri (baca-tulis), bukan lagi WooCommerce REST API. WordPress lama tetap dipakai untuk blog & sebagai file host gambar produk, bukan sumber data produk.

**Bisnis yang berjalan di atas platform ini:**

- Penjualan: Desktop PC, Gaming PC, Laptop, PC Components, Gaming Gear, Office Equipment, Networking, Printer, Monitor, Aksesoris, elektronik lain.
- Layanan: Rakit PC (Custom PC Builder), Service Laptop & PC, Upgrade Hardware, Instalasi, Konsultasi.

---

## 2. Aturan Absolut untuk AI Agent

Aturan berikut **TIDAK BOLEH DILANGGAR** dalam kondisi apapun, meskipun user meminta shortcut.

### 2.1 Jangan Langsung Menulis Kode

Sebelum menulis satu baris kode pun, agent WAJIB melakukan urutan berikut:

1. **Analisis** — Pahami request user dan konteks di dalam codebase.
2. **Jelaskan** — Sampaikan pemahaman agent ke user dalam bahasa yang jelas.
3. **Usulkan opsi** — Berikan minimal 1–2 pendekatan alternatif jika relevan.
4. **Jelaskan trade-off** — Setiap opsi harus disertai kelebihan & kekurangan.
5. **Tunggu approval** — JANGAN eksekusi tanpa persetujuan eksplisit user.
6. **Baru implementasi** — Setelah user memilih pendekatan.

Jika kebutuhan user tidak jelas, **AGENT WAJIB BERTANYA**, bukan berasumsi.

### 2.2 Data Produk — Prisma DB adalah Source of Truth (bukan lagi WooCommerce API)

> **Keputusan 2026-07-25:** aturan awal (data produk wajib dari WooCommerce REST API) sudah tidak berlaku. Jalur baca **dan** tulis data produk sekarang lewat **Prisma DB** (MariaDB Hostinger — `prisma/schema.prisma`, model `Product`/`Category`/`Brand`/dst). Staff HNS sudah 100% pindah ke admin panel baru (`/admin/produk`) untuk kelola produk — wp-admin WooCommerce lama **tidak dipakai lagi** untuk edit produk, supaya tidak ada dua sumber data yang jalan paralel.

- Data produk, kategori, brand, harga, stok, atribut **disimpan & dibaca dari Prisma DB**, lewat layer `lib/api/woocommerce/*.ts` (nama folder historis — isinya sekarang query Prisma via `getPrisma()`, bukan `fetch()` ke WooCommerce).
- Upload **foto** produk tetap lewat WordPress Media REST API (`WORDPRESS_APP_USER`/`WORDPRESS_APP_PASSWORD`) — WordPress di sini hanya berfungsi sebagai file host untuk gambar, bukan sumber data produk. URL hasil upload disimpan di tabel `product_images` (Prisma).
- WordPress tetap dipakai untuk **blog** (`lib/api/wordpress/`) — itu tidak berubah, hanya data produk yang pindah.
- **DILARANG** membuat seed data atau mock data produk permanen di luar proses import CSV terdokumentasi (lihat `scripts/archive/`).
- Mock data hanya boleh dipakai untuk unit test dan Storybook (dengan label jelas).

### 2.3 Jangan Buat Komponen Baru Tanpa Cek Reuse

Sebelum membuat komponen baru, agent WAJIB:

1. Cek folder `components/` — apakah sudah ada komponen serupa?
2. Cek apakah komponen yang ada bisa di-extend lewat props/composition.
3. Baru buat komponen baru jika belum ada yang cocok.

### 2.4 Jangan Pakai `any` di TypeScript

- `any` **DILARANG** kecuali dengan komentar `// eslint-disable-next-line` + alasan yang tertulis.
- Gunakan `unknown` + type guard jika benar-benar tidak tahu tipenya.

### 2.5 Jangan Fetch/Query Data Langsung dari Komponen

- Semua akses data (Prisma DB, WooCommerce/WordPress API yang masih dipakai) harus melalui layer `lib/api/` atau `lib/services/`.
- Komponen (baik Server maupun Client) tidak boleh berisi `fetch()` mentah ke endpoint eksternal, ataupun panggilan `getPrisma()` langsung.
- Alasan: konsistensi caching, error handling, dan mudah di-mock saat testing.

### 2.6 Jangan Skip Responsive

- Setiap komponen UI **WAJIB** dirancang mobile-first.
- Tidak ada komponen yang "mobile-nya dikerjakan belakangan".
- Breakpoint standar mengikuti Tailwind: `sm` (640), `md` (768), `lg` (1024), `xl` (1280), `2xl` (1536).

### 2.7 Harga yang Tampil ke Pelanggan HANYA Berasal dari Katalog

- **DILARANG** menghitung, mengalikan, mengurangi, atau menyimulasikan harga di sisi klien — dengan alasan apa pun.
- Satu-satunya potongan yang sah adalah `salePrice` dari katalog, yang ditetapkan staff lewat panel admin.
- Persentase diskon boleh dihitung, karena ia **keterangan** atas selisih dua angka katalog — bukan sumber potongannya.
- **DILARANG** menampilkan harga yang tidak bisa diperoleh siapa pun, termasuk label seperti "Harga Member" selama mekanismenya tidak ada.
- Harga yang masuk keranjang wajib sama persis dengan harga yang tampil di halaman produk.
- **Status login tidak boleh memengaruhi harga.** Akun pelanggan (login Google) hanya menambah kemampuan menyimpan rakitan — ia tidak membuka harga berbeda, diskon khusus, atau tingkatan member apa pun. Fungsi penetapan harga seperti `priceCartFromCatalog` sengaja TIDAK menerima parameter user; jangan menambahkannya. Kalau suatu hari ada harga khusus, ia datang dari katalog sebagai data, bukan dari status login.

**Ini bukan aturan gaya kode.** Pernah ada `memberPrice = Math.floor(harga * 0.95)` di
`calculate-product-price.ts` yang menyala untuk siapa pun yang "login" — padahal login itu
sendiri simulasi localStorage yang menerima email apa saja. Angka karangan itu ikut ke
keranjang dan ke pesan WhatsApp checkout, sehingga CS menerima total yang tidak bisa
dipenuhi dan harus menolaknya di depan pelanggan yang merasa sudah melihatnya di situs
HNS. Untuk PC rakitan Rp 20 juta, selisihnya Rp 1 juta.

Kalau harga khusus benar-benar dibutuhkan suatu hari, ia harus datang dari katalog sebagai
data — bukan dari perkalian di komponen.

### 2.8 Penghapusan: Soft Delete, dengan Satu Pengecualian yang Disengaja

Tabel milik **internal** memakai soft delete (`deletedAt`) — `users` (admin) dan
`stores`. Alasannya: staff bisa salah tekan, dan baris yang hilang permanen
membawa serta riwayat yang menunjuk padanya.

**PENGECUALIAN — akun pelanggan dihapus permanen (hard delete).**

Saat pelanggan meminta akunnya dihapus, barisnya benar-benar dihapus dari
`customers`, bersama seluruh rakitan tersimpannya lewat `onDelete: Cascade`.
Tidak ada `deletedAt`, tidak ada baris tersisa.

**Jangan "memperbaiki" ini menjadi soft delete.** Soft delete pada data pribadi
berarti kita tetap menyimpan email dan nama orang yang sudah secara eksplisit
meminta datanya dihapus — baris itu masih ada, hanya disembunyikan dari
antarmuka. Itu justru kebalikan dari yang diminta pelanggan, dan menyimpan data
pribadi tanpa dasar setelah pemiliknya menarik persetujuan adalah masalah
kepatuhan, bukan sekadar selera teknis.

Bedanya dengan `users` dan `stores`: keduanya data operasional milik HNS yang
dihapus staff karena salah input atau cabang tutup — bukan data pribadi orang
lain yang menarik persetujuannya.

Yang wajib ikut saat penghapusan: isi `sessionsRevokedAt` sebelum barisnya
hilang. Tanpa itu, cookie bertanda tangan yang sudah beredar tetap sah sampai
kedaluwarsa, dan pemiliknya "masih login" ke akun yang sudah tidak ada.

---

## 3. Peta Dokumentasi Wajib Baca

Sebelum bekerja di area tertentu, baca dokumen terkait di folder `docs/`:

| Dokumen | Wajib dibaca sebelum… |
|---|---|
| [`docs/01-business-context.md`](./docs/01-business-context.md) | Membuat fitur baru, memutuskan prioritas, memahami target user. |
| [`docs/02-architecture.md`](./docs/02-architecture.md) | Membuat file/folder baru, memutuskan Server vs Client Component. |
| [`docs/04-component-guidelines.md`](./docs/04-component-guidelines.md) | Membuat, mengubah, atau memindah komponen UI. |
| [`docs/05-data-fetching.md`](./docs/05-data-fetching.md) | Menambah pemanggilan API, caching, revalidation. |
| [`docs/06-coding-standards.md`](./docs/06-coding-standards.md) | Menulis kode apapun (naming, format, TypeScript). |
| [`docs/07-environment-variables.md`](./docs/07-environment-variables.md) | Menambah integrasi baru, konfigurasi environment. |
| [`docs/08-database-migrations.md`](./docs/08-database-migrations.md) | Mengubah `prisma/schema.prisma`. **`prisma migrate dev` DAN `prisma db push` dua-duanya dilarang di project ini** — sejak 5 Agustus 2026 skema dilacak lewat berkas migrasi di `prisma/migrations/`. Alasan masing-masing ada di dokumen itu. |
| [`docs/10-deployment-procedure.md`](./docs/10-deployment-procedure.md) | Menyiapkan environment/database baru, cutover domain produksi, atau menjalankan perintah apa pun terhadap database produksi. |

---

## 4. Tech Stack Resmi

Perubahan tech stack **HARUS** didiskusikan dan disetujui user, tidak boleh sepihak.

| Kategori | Pilihan | Alasan |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR/ISR, SEO, RSC |
| Language | TypeScript (strict) | Type safety |
| Styling | Tailwind CSS | Produktif, konsisten |
| UI Primitives | shadcn/ui (Radix di bawahnya) | Aksesibel, ownable |
| Client State | Zustand | Ringan untuk cart/wishlist |
| Server State (client) | TanStack Query | Untuk search, infinite scroll, live data |
| Form | React Hook Form + Zod | Validasi type-safe |
| Data Source | Prisma DB (MariaDB Hostinger) | Sumber tunggal produk — lihat §2.2 |
| Icon | lucide-react | Ringan, konsisten |
| Package Manager | npm (`package-lock.json`) | Dipakai seluruh tim |

---

## 5. Checklist Sebelum Commit & Deployment

> **PENTING UNTUK DEPLOYMENT:** Project ini memakai konfigurasi TypeScript dan ESLint yang ketat (strict). Vercel dan environment deployment lain **AKAN GAGAL BUILD** kalau ada error TypeScript (misalnya implicit `any`) atau error ESLint yang tidak tertangani. Jalankan typecheck sebelum commit, jangan menunggu pipeline yang memberitahu.
>
> Perintahnya **`npm run typecheck`** (script `"typecheck": "tsc --noEmit"` di `package.json`). Pakai bentuk ini di semua dokumen dan catatan supaya cuma ada satu perintah yang beredar.
>
> Catatan sejarah: baris ini dulu menyatakan sebaliknya — bahwa script itu *tidak ada* dan yang benar `npx tsc --noEmit`. Pernyataan itu sempat betul, lalu scriptnya ditambahkan ke `package.json` dan baris ini tidak ikut diperbarui, sehingga aturan yang seharusnya menyeragamkan justru menyuruh orang membetulkan yang sudah benar.

Setiap commit harus lolos checklist berikut:

- [ ] Kode lolos `npm run typecheck` (no TypeScript error). **Build produksi gagal kalau ini gagal.**
- [ ] Kode lolos `npm run lint` (no ESLint error).
- [ ] Tidak ada `console.log` yang tertinggal (kecuali di file yang eksplisit).
- [ ] Tidak ada `any` tanpa justifikasi.
- [ ] Tidak ada credential/secret di dalam kode.
- [ ] Komponen baru sudah responsive (mobile → desktop).
- [ ] Perubahan API sudah didokumentasikan di `docs/05-data-fetching.md`.
- [ ] Perubahan env var sudah ditambahkan di `.env.example` DAN `docs/07-environment-variables.md`.

---

## 6. Format Interaksi yang Diharapkan

Saat user meminta sesuatu, format respons agent idealnya:

```
[Pemahaman Saya]
Ringkasan singkat tentang apa yang user minta.

[Konteks Terkait di Codebase]
File/komponen/fungsi yang relevan (jika ada).

[Opsi Pendekatan]
1. Opsi A — [penjelasan] — trade-off: ...
2. Opsi B — [penjelasan] — trade-off: ...

[Rekomendasi]
Saya rekomendasikan opsi X karena ...

[Menunggu Approval]
Boleh saya lanjut dengan opsi X, atau ada yang perlu disesuaikan?
```

Untuk request kecil & jelas (misal "rename variable X jadi Y"), format bisa lebih singkat — tapi tetap ada konfirmasi jika ada ambiguitas.

---

## 7. Bahasa

- Diskusi dengan user: **Bahasa Indonesia** (kecuali user memakai bahasa lain).
- Nama variable, fungsi, komponen, komentar kode: **Bahasa Inggris**.
- Copywriting UI yang ditampilkan ke customer: **Bahasa Indonesia**.

---

## 8. Prinsip Terakhir

> **Tujuan agent bukan menghasilkan kode secepat mungkin, tapi membangun platform e-commerce terbaik yang bisa di-maintain jangka panjang.**

Jika ragu, tanya. Jika kode terasa "berbau tidak enak" (code smell), angkat masalahnya ke user sebelum lanjut.
