# 15 — SEO: Metadata, Peta Situs, dan Ikon Pencarian

> Ditambahkan 21 September 2026. Baca sebelum menyentuh `src/app/layout.tsx`
> (bagian `metadata`), `src/app/sitemap.ts`, `robots.ts`, atau tag SEO halaman.

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

- **JSON-LD produk masih dasar:** nama, gambar, harga, stok. Belum ada `brand`,
  `sku`, `description`, `BreadcrumbList`, `shippingDetails`, dan
  `hasMerchantReturnPolicy`. Agres (kompetitor) memuat semuanya.
- **Deskripsi produk tipis** (±350 kata per halaman) dan blog masih nonaktif.
- **LCP mobile 5,2 detik** di beranda (PageSpeed Insights, 15 September 2026),
  sementara batas "baik" Google 2,5 detik. HTML beranda ±650 KB.
- **GPTBot ditolak 429** oleh CDN Hostinger. Kalau HNS ingin muncul di jawaban
  ChatGPT Search, ini diatur di Hostinger, bukan di kode.
