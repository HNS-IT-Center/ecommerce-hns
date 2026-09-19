# 14 — PWA (Progressive Web App)

> Ditambahkan 19 September 2026. Wajib dibaca sebelum menyentuh `public/sw.js`,
> `public/offline.html`, `src/app/manifest.ts`, atau `src/features/pwa/`.

Situs bisa dipasang ("install") sebagai aplikasi di Android, iOS/iPadOS, dan
desktop (Chrome/Edge). Isinya tetap situs yang sama — tidak ada kode aplikasi
terpisah yang perlu dirawat.

## 1. Aturan Utama: Service Worker TIDAK Boleh Menyimpan Halaman atau API

Halaman produk, keranjang, dan respons `/api/*` membawa harga dan stok. Kalau
service worker menyimpannya, pelanggan bisa melihat harga yang sudah diubah staff,
lalu angka lama itu ikut ke keranjang dan pesan WhatsApp checkout — pelanggaran
langsung terhadap CLAUDE.md §2.7.

Karena itu `public/sw.js` hanya:

| Permintaan | Perlakuan |
|---|---|
| Navigasi halaman | Selalu ke jaringan. Gagal (offline) → `/offline.html`. |
| `/_next/static/*`, `/icons/*` | Cache-first. Aman karena nama berkas ber-hash per build. Maks 300 entri. |
| Semua yang lain (`/api`, `/admin`, gambar R2/WordPress, lintas origin) | Tidak disentuh sama sekali. |

**Jangan menambah strategi cache untuk halaman, API, atau data produk** — termasuk
"stale-while-revalidate". Kalau suatu hari fitur offline yang lebih kaya
dibutuhkan, diskusikan dulu dengan user.

## 2. Berkas

| Berkas | Isi |
|---|---|
| `src/app/manifest.ts` | Web App Manifest (`/manifest.webmanifest`). |
| `public/sw.js` | Service worker. Naikkan `CACHE_VERSION` setelah mengubahnya atau `offline.html`. |
| `public/offline.html` | Halaman offline mandiri (CSS inline). Tanpa produk/harga. |
| `public/icons/*` | Ikon, dihasilkan oleh `node scripts/generate-pwa-icons.mts`. Jangan diedit manual. |
| `src/app/layout.tsx` | `appleWebApp`, `apple-touch-icon`, `themeColor`; memasang `PwaRegister` dan `InstallChip`. |
| `next.config.ts` → `headers()` | `Cache-Control: no-cache` untuk `/sw.js`, supaya pembaruan SW tidak tertahan. |
| `src/features/pwa/` | State install, hook, dan komponen tombol install. |

Service worker hanya didaftarkan di **production** (`NODE_ENV === "production"`).
Untuk menguji lokal: `npm run build:app && npm start`, lalu buka DevTools →
Application → Manifest / Service Workers.

## 3. Tombol Install — Sengaja Tidak Mengganggu

Keputusan user 19 September 2026: pasif + satu chip.

- **Footer** (kolom Bantuan) dan **halaman Profil**: tombol "Pasang Aplikasi HNS".
- **Chip** di beranda, mobile saja, muncul setelah 20 detik, di atas dock dan di
  kiri tombol WhatsApp. Muncul **sekali per 30 hari** (`localStorage`
  `hns:pwa-chip-shown-at`, dicatat saat chip tampil). Tidak pernah muncul di
  halaman produk, keranjang, atau checkout.
- Mini-infobar otomatis Chrome Android **dimatikan** (`preventDefault` pada
  `beforeinstallprompt`) supaya tidak ada tawaran install yang tidak kita kendalikan.

Semua tombol otomatis tersembunyi bila browser tidak bisa memasang situs (mis.
Firefox desktop) atau aplikasi sudah terpasang.

## 4. Perilaku per Platform

| Platform | Cara pasang | Catatan |
|---|---|---|
| Android (Chrome, Edge, Samsung Internet) | Tombol kita → dialog native | Chrome membuat WebAPK (tampil di laci aplikasi). |
| Desktop (Chrome, Edge) | Tombol kita, atau ikon di bilah alamat | Jadi jendela sendiri + entri Start Menu/Dock. |
| iOS / iPadOS | Tombol kita → dialog petunjuk "Bagikan → Tambahkan ke Layar Utama" | Apple tidak menyediakan API prompt. Ikon & judul diambil dari `appleWebApp` + `apple-touch-icon`, bukan manifest. |

## 5. Belum Dikerjakan (Opsi Lanjutan)

- **Play Store (TWA)** lewat Bubblewrap/PWABuilder. Butuh akun Google Play
  Developer dan `/.well-known/assetlinks.json`.
- **Push notification.** Butuh VAPID key (env var baru) dan persetujuan user.

## 6. Tautan `target="_blank"` di Aplikasi Terpasang

Keputusan user 19 September 2026: di aplikasi terpasang, tautan ke halaman HNS
sendiri **tidak** membuka tab baru.

Alasannya bukan sekadar kenyamanan. Tab baru keluar dari jendela aplikasi — di
Android ke tab Chrome, di iOS ke Safari. iOS memisahkan penyimpanan aplikasi
terpasang dari Safari, jadi pelanggan mendarat dengan **keranjang kosong dan
status belum login**.

| Jenis | Di browser | Di aplikasi terpasang |
|---|---|---|
| `<a target="_blank">` ke situs HNS | Tab baru (tidak berubah) | Navigasi di jendela yang sama — `StandaloneLinkHandler` |
| `window.open` ke situs HNS | Tab baru | Jendela yang sama — **wajib** lewat `openInternal()` (`features/pwa/lib/open-internal.ts`) |
| Tautan keluar (WhatsApp, Maps, sosial media) | Tab baru | Tetap keluar — memang harus membuka aplikasinya sendiri |

Aturan untuk kode baru:

- `<a target="_blank">` ke halaman internal boleh dipakai seperti biasa; pencegat
  global menanganinya.
- `window.open` ke halaman internal **jangan** dipanggil langsung — pakai
  `openInternal(path)`. Pencegat tidak bisa melihat `window.open`.
- Halaman yang dibuka dengan cara ini wajib punya jalan kembali yang terlihat
  (lihat `PrintClientComponent`): aplikasi terpasang di iOS tidak punya tombol Back.
- `useUnsavedChangesGuard` ikut menjaga tautan `_blank` internal saat di
  aplikasi terpasang, karena di sana halaman memang ditinggalkan.
