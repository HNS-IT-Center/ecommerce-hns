# CLAUDE.md — Panduan Utama AI Agent untuk Project HNS IT Center

> **File ini WAJIB dibaca sepenuhnya sebelum melakukan tindakan apapun di dalam project ini.**
> File ini adalah "konstitusi" project. Semua aturan lain di folder `docs/` adalah turunan dari file ini.

---

## 1. Tentang Project Ini

Project ini adalah **rebuild** dari website e-commerce **HNS IT Center Batam** (hnsitcenter.id) menggunakan **Next.js (App Router)**.

Website lama berjalan di WordPress + WooCommerce dengan ribuan produk. Rebuild ini bertujuan:

- Meningkatkan performa, SEO, dan pengalaman pengguna.
- Menggantikan frontend WordPress dengan Next.js modern.
- **TIDAK** mengubah sumber data — WooCommerce tetap jadi backend data selama Fase 1–2 migrasi.

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

### 2.2 Jangan Buat Ulang Data Produk

- Data produk, kategori, brand, gambar, harga, stok, deskripsi, dan SEO **HARUS** diambil dari WooCommerce REST API.
- **DILARANG** membuat seed data, mock data permanen, atau hardcode produk di dalam repo.
- Mock data hanya boleh dipakai untuk unit test dan Storybook (dengan label jelas).

### 2.3 Jangan Buat Komponen Baru Tanpa Cek Reuse

Sebelum membuat komponen baru, agent WAJIB:

1. Cek folder `components/` — apakah sudah ada komponen serupa?
2. Cek apakah komponen yang ada bisa di-extend lewat props/composition.
3. Baru buat komponen baru jika belum ada yang cocok.

### 2.4 Jangan Pakai `any` di TypeScript

- `any` **DILARANG** kecuali dengan komentar `// eslint-disable-next-line` + alasan yang tertulis.
- Gunakan `unknown` + type guard jika benar-benar tidak tahu tipenya.

### 2.5 Jangan Fetch Data Langsung dari Komponen

- Semua panggilan ke WooCommerce API harus melalui layer `lib/api/` atau `lib/services/`.
- Komponen (baik Server maupun Client) tidak boleh berisi `fetch()` mentah ke endpoint eksternal.
- Alasan: konsistensi caching, error handling, dan mudah di-mock saat testing.

### 2.6 Jangan Skip Responsive

- Setiap komponen UI **WAJIB** dirancang mobile-first.
- Tidak ada komponen yang "mobile-nya dikerjakan belakangan".
- Breakpoint standar mengikuti Tailwind: `sm` (640), `md` (768), `lg` (1024), `xl` (1280), `2xl` (1536).

---

## 3. Peta Dokumentasi Wajib Baca

Sebelum bekerja di area tertentu, baca dokumen terkait di folder `docs/`:

| Dokumen | Wajib dibaca sebelum… |
|---|---|
| [`docs/01-business-context.md`](./docs/01-business-context.md) | Membuat fitur baru, memutuskan prioritas, memahami target user. |
| [`docs/02-architecture.md`](./docs/02-architecture.md) | Membuat file/folder baru, memutuskan Server vs Client Component. |
| [`docs/03-state-management.md`](./docs/03-state-management.md) | Menambah state, cart, wishlist, filter, atau global store. |
| [`docs/04-component-guidelines.md`](./docs/04-component-guidelines.md) | Membuat, mengubah, atau memindah komponen UI. |
| [`docs/05-data-fetching.md`](./docs/05-data-fetching.md) | Menambah pemanggilan API, caching, revalidation. |
| [`docs/06-coding-standards.md`](./docs/06-coding-standards.md) | Menulis kode apapun (naming, format, TypeScript). |
| [`docs/07-environment-variables.md`](./docs/07-environment-variables.md) | Menambah integrasi baru, konfigurasi environment. |

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
| Data Source | WooCommerce REST API v3 | Sumber tunggal produk |
| Icon | lucide-react | Ringan, konsisten |
| Package Manager | pnpm | Cepat, hemat disk |

---

## 5. Checklist Sebelum Commit

Setiap commit harus lolos checklist berikut:

- [ ] Kode lolos `pnpm typecheck` (no TypeScript error).
- [ ] Kode lolos `pnpm lint` (no ESLint error).
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
