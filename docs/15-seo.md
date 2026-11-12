# 15 — SEO: Metadata, Peta Situs, dan Ikon Pencarian

> Ditambahkan 21 September 2026. Baca sebelum menyentuh `src/app/layout.tsx`
> (bagian `metadata`), `src/app/sitemap.ts`, `robots.ts`, atau tag SEO halaman.
> Daftar kerja GEO (supaya HNS dikutip jawaban AI) ada di §8.

## 1. Di Mana Metadata Ditetapkan

| Yang ditetapkan | Tempatnya | Catatan |
|---|---|---|
| `metadataBase`, title template, deskripsi bawaan | `app/layout.tsx` | `metadataBase` = `NEXT_PUBLIC_SITE_URL`. Kalau env ini salah, SELURUH URL absolut ikut salah. |
| Open Graph & Twitter Card bawaan | `app/layout.tsx` | Diwarisi semua halaman; halaman produk menimpanya dengan foto produk sendiri. |
| Ikon (favicon, PNG, apple-touch) | `app/layout.tsx` → `icons` | Lihat §3. |
| **Canonical** | **Per halaman**, bukan di layout | Lihat §2. |
| `robots: { index: false }` | Halaman terkait | `/search`, `/profile`, dsb. |

### Aturan penting: canonical TIDAK BOLEH ditaruh di layout

`alternates.canonical` di `layout.tsx` diwarisi oleh setiap halaman yang tidak
menimpanya. Akibatnya seluruh situs menyatakan dirinya salinan beranda, dan itu
cara tercepat membuat halaman produk hilang dari hasil pencarian.

Canonical ditetapkan oleh halaman yang membutuhkannya: `app/page.tsx` (`"/"`)
dan `app/product/[slug]/page.tsx` (`/product/<slug>`). Tulis sebagai path
relatif — `metadataBase` yang menjadikannya absolut.

## 2. Peta Situs (`app/sitemap.ts`)

- Halaman statis ada di `STATIC_ROUTES`.
- Produk dan kategori dibaca dari database.
- **PC Prebuild masuk hanya kalau `config.enabled` menyala.** Saat fiturnya
  dimatikan staff, `/pc-prebuild` dan tiap halaman paketnya me-redirect ke
  `/build-pc`; mengumumkan alamat yang selalu mengalihkan membuat crawler
  menilainya duplikat halaman tujuan.
- Host non-produksi (staging, localhost) menghasilkan peta **kosong**, bukan
  404 — lihat komentar di berkasnya.
- Yang sengaja tidak dipetakan: `/admin`, `/search`, `/cart`, `/checkout`,
  `/login`, `/register`, `/build-pc/print`.

## 3. Ikon di Hasil Pencarian Google

Ikon kecil di samping hasil pencarian adalah **favicon**, dan Google meminta
gambar persegi dengan sisi kelipatan 48 piksel. `src/app/favicon.ico` berukuran
256×256, jadi sejak 21 September 2026 didaftarkan pula PNG 192×192 dari ikon PWA
(`/icons/icon-192.png`) di samping `.ico`, yang tetap dipertahankan untuk tab
browser.

Google hanya memperbarui favicon saat merayapi ulang beranda. Perubahan di sini
tidak langsung terlihat di hasil pencarian — hitungannya hari sampai minggu.

## 4. Gambar Pratinjau Tautan (Open Graph)

`public/og-image.png` (1200×630) dihasilkan oleh
`node scripts/generate-og-image.mts`. Jangan menyuntingnya langsung; ubah
skripnya lalu jalankan ulang. Ia memakai tanda "HNS" saja, bukan logo penuh,
karena logo sudah memuat tulisan "#1 IT CENTER BATAM" yang bertabrakan dengan
keterangan di bawahnya.

## 5. Sitelinks Tidak Bisa Diatur

Daftar tautan di bawah hasil pencarian (Katalog Produk, Toko & cabang kami, dst.)
dipilih Google sendiri. Tidak ada pengaturannya, baik di sitemap maupun Search
Console — alat "demote sitelinks" sudah dihapus Google. Yang bisa dilakukan
hanya memperjelas struktur: tautan internal, judul halaman, dan membuang halaman
mati.

## 6. Langkah Manual di Search Console (Tidak Bisa Lewat Kode)

Setelah perubahan SEO ter-deploy:

1. **Sitemaps** → kirim ulang `sitemap.xml`.
2. **Removals** → hapus URL peninggalan WordPress yang masih terindeks
   (`/members`, `/deals-of-the-day`). Keduanya sudah 404 di situs baru.
3. **URL Inspection** → minta pengindeksan ulang beranda supaya favicon dan
   sitelinks lebih cepat disegarkan.
4. Periksa laporan **Merchant listings** untuk peringatan structured data produk
   (ongkir dan kebijakan retur belum ada di JSON-LD produk — lihat §7).

## 7. Belum Dikerjakan

- **JSON-LD produk belum lengkap.** Yang SUDAH ada (dicek 8 November 2026 di
  `app/product/[slug]/page.tsx`): nama, gambar, description, sku, brand, harga,
  stok, rating. Yang BELUM: `BreadcrumbList`, `shippingDetails`,
  `hasMerchantReturnPolicy`, `seller`, `itemCondition`, spesifikasi. Rinciannya
  di §8.2. Agres (kompetitor) memuat semuanya.
- **Deskripsi produk tipis** (±350 kata per halaman) dan blog masih nonaktif.
- **LCP mobile 5,2 detik** di beranda (PageSpeed Insights, 15 September 2026),
  sementara batas "baik" Google 2,5 detik. HTML beranda ±650 KB.
- **GPTBot ditolak 429** oleh CDN Hostinger. Ini TIDAK menghalangi ChatGPT
  Search — yang dipakai ChatGPT Search adalah `OAI-SearchBot`, dan ia lolos
  (200). GPTBot hanya untuk pelatihan model. Lihat §8.1.

## 8. GEO — Supaya HNS Dikutip Jawaban AI

> Ditambahkan 8 November 2026. Belum ada satu pun yang dikerjakan; bagian ini
> adalah daftar kerja, bukan catatan hasil.

**GEO** (*Generative Engine Optimization*) = membuat HNS **disebut dan dikutip**
di jawaban ChatGPT Search, Perplexity, Gemini, dan Google AI Overviews — misalnya
saat orang bertanya "toko rakit PC terpercaya di Batam".

GEO bukan pengganti SEO, melainkan lapisan di atasnya. **Google AI Overviews
memakai indeks Google Search biasa**, jadi semua yang di §1–§7 tetap fondasinya.
Yang ditambah GEO: data yang bisa dibaca mesin tanpa menebak, konten yang
langsung menjawab pertanyaan, dan sinyal kepercayaan dari luar situs.

### 8.1 Akses Bot AI (diuji 8 November 2026, `curl` ke `https://hnsitcenter.id/`)

| Bot | Hasil | Gunanya |
|---|---|---|
| `OAI-SearchBot` | 200 ✅ | ChatGPT Search — yang menentukan HNS muncul di ChatGPT |
| `PerplexityBot` | 200 ✅ | Perplexity |
| `ClaudeBot` | 200 ✅ | Claude |
| `GPTBot` | 429 ❌ | **Pelatihan** model OpenAI, bukan pencarian |
| `Googlebot` (UA palsu) | 403 | Wajar — CDN memeriksa IP asli Google, UA tiruan dari IP lain ditolak |

`robots.ts` mengizinkan semua bot (`userAgent: "*"`); penolakan GPTBot datang
dari CDN Hostinger. **Membuka GPTBot adalah keputusan bisnis** (boleh tidaknya
konten HNS dipakai melatih model), bukan perbaikan teknis — belum diputuskan.

`Google-Extended` bukan crawler, hanya token izin untuk pelatihan/grounding
Gemini. Memblokirnya TIDAK mengeluarkan HNS dari AI Overviews.

### 8.2 Pekerjaan Kode — Data Terstruktur (risiko rendah)

Semua lewat komponen `components/seo/json-ld.tsx` yang sudah ada.

| # | Pekerjaan | Tempat | Prasyarat |
|---|---|---|---|
| K1 | `BreadcrumbList` (Beranda › Kategori › Produk) | halaman produk & `category/[slug]` | — |
| K2 | `seller` → `{"@id": ".../#organization"}`, `itemCondition: NewCondition` | JSON-LD produk | — |
| K3 | Spesifikasi sebagai `additionalProperty` (`PropertyValue`) dari atribut katalog | JSON-LD produk | — |
| K4 | `sameAs` (Instagram, TikTok sudah ada di `SOCIAL_LINKS`) + `logo` | `organizationJsonLd` di `app/layout.tsx` | Tautan Google Maps & marketplace dari user |
| K5 | `FAQPage` | `app/faq/page.tsx` | **Isi FAQ dibetulkan dulu** — lihat 8.5 |
| K6 | `CollectionPage` + `ItemList` produk | `category/[slug]` | — |
| K7 | `shippingDetails` + `hasMerchantReturnPolicy` | JSON-LD produk | **Kebijakan sungguhan dari user** — lihat aturan di bawah |
| K8 | `llms.txt` di `public/` (ringkasan HNS + tautan halaman penting) | `public/llms.txt` | Opsional; belum ada mesin AI besar yang resmi memakainya |

Aturan untuk K7: ongkir dan masa retur **tidak boleh dikarang**. Semangatnya
sama dengan CLAUDE.md §2.7 — angka di structured data dibaca mesin lalu
diulang ke pelanggan sebagai janji HNS. Kalau datanya belum ada, K7 dilewati.

Harga di JSON-LD tetap diambil dari katalog (`product.price`), sama dengan yang
tampil di halaman. Jangan menambah harga turunan apa pun di sini.

### 8.3 Pekerjaan Konten (dampak terbesar, butuh staff)

- **Deskripsi produk menjawab pertanyaan pembeli**: untuk siapa, kegunaannya,
  dibanding apa, garansinya apa. Sekarang rata-rata ±350 kata dan umumnya
  daftar spesifikasi. Mulai dari produk paling laku/bermargin, bukan semua 5.000+.
- **Blog dihidupkan lagi** (sekarang dinonaktifkan, lihat memori "WooCommerce
  lama sudah mati") dengan artikel berbentuk pertanyaan: "Rakit PC gaming 10 juta
  di Batam", "Service laptop mati total, berapa biayanya", dst.
- **Halaman layanan** (rakit PC, service, upgrade) dengan jawaban langsung
  di paragraf pertama — AI mengutip kalimat yang bisa berdiri sendiri.
- **LCP mobile** (§7) — kecepatan tetap memengaruhi indeks Google, sumber AI
  Overviews.

### 8.4 Sinyal di Luar Situs (tidak bisa lewat kode)

- **Google Business Profile** tiap cabang: ulasan, foto, jam buka, kategori
  "Computer store" — sumber utama jawaban AI untuk pertanyaan lokal.
- Nama, alamat, telepon **seragam** di semua tempat (GBP, Instagram, TikTok,
  marketplace, situs). Catatan: 2 cabang masih memakai nomor WA yang sama.
- Disebut di situs/forum/media lokal Batam — AI lebih percaya sumber yang
  dikutip pihak lain.

### 8.5 Penghalang yang Harus Dibereskan Dulu

- **FAQ masih memuat BNI dan QRIS** di fallback
  `lib/constants/policy-content.ts` (baris ±178), padahal HNS tidak menerima
  keduanya (lihat `BANK_ACCOUNTS` di `lib/constants/contact.ts`). FAQ yang
  tayang dibaca dari tabel `faq_items` — isinya di produksi belum dicek. Kalau
  info keliru ini dijadikan `FAQPage` (K5), AI justru makin mudah mengutipnya.

### 8.6 Cara Mengukur

GEO tidak punya dasbor seperti Search Console. **Sebelum** mengubah apa pun,
catat hasil pertanyaan berikut di ChatGPT (mode search), Perplexity, Gemini,
dan Google (AI Overview), lalu ulangi sebulan setelah perubahan:

- "toko komputer di Batam"
- "rakit PC gaming di Batam"
- "service laptop Batam"
- "beli laptop garansi resmi Batam"

Yang dicatat: HNS disebut atau tidak, dikutip dari halaman mana, dan siapa
kompetitor yang disebut.

### 8.7 Urutan yang Disarankan

1. Ukur dulu (8.6).
2. Bereskan FAQ (8.5).
3. K1, K2, K3, K4, K6 — tidak butuh data baru dari siapa pun selain tautan K4.
4. K5 setelah FAQ benar; K7 setelah kebijakan ada.
5. Konten (8.3) dan sinyal luar (8.4) berjalan paralel, dikerjakan staff.
6. K8 kalau sempat.
