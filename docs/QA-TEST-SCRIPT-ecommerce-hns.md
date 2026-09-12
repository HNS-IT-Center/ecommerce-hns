# QA Test Script — ecommerce-hns (HNS IT Center)

> **Versi:** 1.0
> **Cakupan:** Guest User → Registered Customer → Admin Panel
> **Stack:** Next.js App Router, TypeScript, Tailwind, Prisma/MariaDB, Hostinger
> **Lokasi dokumen:** `docs/QA-TEST-SCRIPT-ecommerce-hns.md` (commit ke repo, jangan gitignore)

---

## 0. Informasi Umum

### 0.1 Environment Matrix

| Env | URL | Database | Catatan |
|---|---|---|---|
| Local | `http://localhost:3000` | MariaDB lokal / branch DB | Boleh destructive test |
| Staging | `https://store.hnsitcenter.id` | DB staging | **Wajib** `Disallow: /` di robots.txt |
| Production | `https://hnsitcenter.id` | DB production | Read-only test saja, tidak boleh buat order dummy |

### 0.2 Browser & Device Matrix

| Kategori | Target minimum |
|---|---|
| Desktop | Chrome (latest), Edge, Firefox, Safari macOS |
| Mobile | Chrome Android, Safari iOS |
| Viewport | 360px, 390px, 768px, 1024px, 1440px |
| Kondisi jaringan | Fast 3G throttling (uji skeleton/loading state) |

### 0.3 Test Data (siapkan sebelum eksekusi)

| Kode | Deskripsi |
|---|---|
| `TD-01` | Email baru belum pernah registrasi (untuk alur register) |
| `TD-02` | Akun customer terverifikasi + password diketahui |
| `TD-03` | Akun customer **belum** verifikasi email |
| `TD-04` | Akun Google (OAuth) yang belum pernah dipakai di sistem |
| `TD-05` | Akun Google dengan email yang **sama** dengan akun email+password (uji penolakan daftar manual) |
| `TD-06` | Akun admin role `owner` |
| `TD-07` | Akun admin role `staff` |
| `TD-08` | Produk stok > 0, produk stok 0, produk nonaktif/draft |
| `TD-09` | Produk dengan harga promo / diskon aktif |
| `TD-10` | Rakitan PC tersimpan milik `TD-02` yang memuat produk yang harganya akan diubah admin |

### 0.4 Definisi Severity

| Level | Definisi | Contoh |
|---|---|---|
| **S1 Blocker** | Alur bisnis utama mati, atau kebocoran data/keamanan | Checkout gagal total, harga bocor ke endpoint eksternal, staff bisa hapus customer |
| **S2 Critical** | Fitur penting rusak tanpa workaround | Verifikasi email tidak terkirim, filter katalog error |
| **S3 Major** | Fitur rusak tapi ada workaround | Pagination lompat halaman |
| **S4 Minor** | Kosmetik / teks / spacing | Typo, ikon misaligned |

### 0.5 Entry Criteria
- Build sukses (`next build`), lint tidak ada error baru
- Migration `prisma migrate deploy` sudah dijalankan di env target
- Seed data & test data (§0.3) tersedia
- Tidak ada S1 terbuka dari siklus sebelumnya

**Wajib dicatat sebelum eksekusi — nilainya mengubah lingkup:**

| Yang dicek | Kenapa penting |
|---|---|
| `REGISTER_MANUAL_ENABLED` di env target | Kalau `false`, `/register` melempar ke `/login` dan **seluruh §2.1 + TD-01/TD-03 gugur**. Bawaannya `false` kalau variabelnya tidak ditulis |
| Target uji = **staging** `store.hnsitcenter.id` | Bukan produksi. Lihat catatan robots di bawah |
| Commit yang sedang berjalan | Deploy menarik dari branch **`development`**, bukan `team`/`main`. Build basi adalah penyebab bug palsu yang sudah pernah memakan waktu sehari |

> ⚠️ **`/robots.txt` di staging berisi `Disallow: /` — itu BENAR, bukan cacat.**
> `store.hnsitcenter.id` sengaja ditutup dari mesin pencari supaya tidak bersaing
> dengan situs asli (`lib/utils/indexable-host.ts`). Jangan laporkan sebagai bug.
> Cabang "boleh diindeks" tetap bisa diuji dari staging:
>
> ```bash
> curl -H "x-forwarded-host: hnsitcenter.id" https://store.hnsitcenter.id/robots.txt
> ```

> **Versi yang sedang berjalan** dapat dipastikan lewat `/api/admin/version`
> (butuh sesi admin). Kalau ia menjawab 404, build-nya lebih tua dari 13 Agustus
> 2026 — hentikan eksekusi dan minta deploy ulang sebelum melaporkan apa pun.

### 0.6 Prinsip Wajib (dari CLAUDE.md)
> ⚠️ **Build lulus ≠ UI benar.** Semua test case di dokumen ini harus dieksekusi lewat **browser sungguhan**, bukan hanya lewat type-check/lint/build.

---

# 1. ALUR GUEST USER (belum login)

## 1.1 Landing & Navigasi — `GST-1xx`

| ID | Skenario | Langkah | Expected Result | Prio |
|---|---|---|---|---|
| GST-101 | Homepage render | Buka `/` sebagai guest (incognito) | Halaman tampil < 3 detik, tidak ada layout shift parah, tidak ada error di console | P0 |
| GST-102 | Header nav | Klik setiap item menu utama | Semua route valid, tidak ada 404, active state benar | P0 |
| GST-103 | Footer link | Klik semua link footer | Semua tujuan valid, link eksternal `rel="noopener noreferrer"` | P2 |
| GST-104 | Logo → home | Klik logo dari halaman dalam | Kembali ke `/` | P2 |
| GST-105 | Status buka/tutup toko | Amati indikator jam operasional di homepage/header | Status dihitung dengan `Intl.DateTimeFormat` timeZone `Asia/Jakarta`, **dirender setelah hydration** (tidak ada mismatch server/client) | P1 |
| GST-106 | Jam operasional dari DB | Ubah jam buka via admin → refresh homepage | Nilai ikut berubah — membuktikan tidak ada hardcode | P0 |
| GST-107 | Mobile menu | Buka di 360px, buka & tutup hamburger | Menu bisa dibuka, di-scroll, ditutup; body scroll ter-lock saat menu terbuka | P1 |
| GST-108 | Halaman 404 | Akses `/route-tidak-ada` | Halaman 404 custom, ada CTA balik ke katalog | P2 |
| GST-109 | Error boundary | Simulasikan API down (matikan DB / block route) | Muncul error state yang ramah, bukan stack trace mentah | P1 |

## 1.2 Katalog, Pencarian & Filter — `GST-2xx`

| ID | Skenario | Langkah | Expected Result | Prio |
|---|---|---|---|---|
| GST-201 | Listing produk | Buka halaman katalog | Produk tampil dengan gambar, nama, harga; produk draft/nonaktif **tidak** muncul | P0 |
| GST-202 | Produk stok 0 | Cari produk `TD-08` stok 0 | Ditandai "Stok habis", tombol beli disabled atau dialihkan ke inquiry | P0 |
| GST-203 | Filter kategori | Pilih 1 kategori | Hasil sesuai, jumlah produk konsisten dengan counter | P0 |
| GST-204 | Filter kombinasi | Kategori + brand + rentang harga bersamaan | Hasil irisan benar (AND), bukan gabungan (OR) | P1 |
| GST-205 | Filter state di URL | Terapkan filter → copy URL → buka di tab baru | Filter ter-restore dari query param | P1 |
| GST-206 | Reset filter | Klik reset | Semua filter bersih, listing kembali penuh | P2 |
| GST-207 | Sorting | Urutkan harga termurah / termahal / terbaru | Urutan benar dan konsisten lintas halaman pagination | P1 |
| GST-208 | Pagination | Navigasi ke halaman 2, 3, terakhir | Tidak ada produk duplikat/hilang antar halaman; filter tetap terbawa | P1 |
| GST-209 | Search hasil ada | Cari kata kunci produk yang ada | Hasil relevan, keyword ter-highlight (jika ada) | P0 |
| GST-210 | Search hasil kosong | Cari string acak `zzqqxx` | Empty state jelas + saran/CTA, bukan halaman blank | P1 |
| GST-211 | Search karakter khusus | Cari `<script>alert(1)</script>` dan `' OR 1=1--` | Tidak ada eksekusi script (XSS), tidak ada error SQL, input ter-escape | P0 |
| GST-212 | Search case & spasi | Cari `RTX 4060`, `rtx4060`, ` rtx 4060 ` | Hasil setara, trimming bekerja | P2 |
| GST-213 | Loading state | Filter dengan network throttle | Skeleton/spinner muncul, tidak ada "flash of empty state" | P2 |

## 1.3 Halaman Detail Produk — `GST-3xx`

| ID | Skenario | Langkah | Expected Result | Prio |
|---|---|---|---|---|
| GST-301 | Detail render | Buka detail produk | Nama, harga, stok, spesifikasi, gambar, deskripsi tampil lengkap | P0 |
| GST-302 | Harga promo | Buka produk `TD-09` | Harga coret + harga promo tampil benar; perhitungan diskon akurat | P0 |
| GST-303 | Galeri gambar | Klik thumbnail, zoom, swipe di mobile | Gambar utama berganti, tidak ada broken image, `alt` terisi | P1 |
| GST-304 | Produk tidak ada | Akses slug/ID yang tidak valid | 404 proper (bukan 500) | P1 |
| GST-305 | Produk nonaktif | Akses langsung URL produk draft | 404 atau redirect — **tidak boleh** tampil ke publik | P0 |
| GST-306 | Tombol WhatsApp | Klik tombol tanya/pesan via WA | Pesan WA **memang memuat harga** — itu disengaja. Yang diuji: angkanya **identik dengan katalog** dan berasal dari server, bukan dari localStorage klien | P0 |
| GST-307 | Produk terkait | Scroll ke bagian rekomendasi | Item relevan, tidak menampilkan produk itu sendiri, tidak menampilkan produk nonaktif | P2 |
| GST-308 | Metadata SEO | View source / cek `<head>` | Title, meta description, OG image, canonical, JSON-LD Product terisi benar per produk | P1 |
| GST-309 | Share link | Copy link produk, buka di tab incognito | Halaman terbuka normal tanpa perlu login | P2 |

## 1.4 Keranjang Guest — `GST-4xx`

| ID | Skenario | Langkah | Expected Result | Prio |
|---|---|---|---|---|
| GST-401 | Tambah ke keranjang | Klik "Tambah" dari detail & dari card katalog | Item masuk, badge counter bertambah, ada feedback (toast) | P0 |
| GST-402 | Persistensi keranjang | Tambah item → refresh → tutup & buka tab | Tetap ada. Sumbernya **localStorage** (`hns-cart-storage`), bukan DB — jadi incognito & device lain memang kosong, itu bukan cacat | P0 |
| GST-403 | Ubah qty | Naik/turun qty, input manual | Subtotal terhitung ulang benar | P0 |
| GST-404 | Qty melebihi stok | Set qty > stok tersedia | Ditolak dengan pesan jelas, qty dibatasi ke stok maksimal | P0 |
| GST-405 | Qty invalid | Input `0`, `-1`, `abc`, `9999999` | Divalidasi di client **dan** server; tidak menyebabkan error | P0 |
| GST-406 | Hapus item | Hapus item dari keranjang | Item hilang, total update, ada undo/konfirmasi | P1 |
| GST-407 | Keranjang kosong | Hapus semua item | Empty state + CTA ke katalog | P2 |
| GST-408 | Produk berubah saat di keranjang | Admin ubah harga / nonaktifkan produk yang ada di keranjang guest → buka keranjang | Harga tersinkron ke nilai terbaru; produk nonaktif diberi notice & tidak bisa dicheckout | P0 |
| GST-409 | Manipulasi harga client-side | Edit nilai harga via DevTools → lanjut checkout | Server **mengabaikan** harga dari client dan menghitung ulang dari DB | P0 |

## 1.5 PC Builder / Rakitan (Guest) — `GST-5xx`

| ID | Skenario | Langkah | Expected Result | Prio |
|---|---|---|---|---|
| GST-501 | Pilih komponen | Pilih CPU, MB, RAM, GPU, PSU, dst. | Setiap slot bisa diisi & diganti; total harga terupdate | P0 |
| GST-502 | Validasi kompatibilitas | Pasang CPU & motherboard beda socket | Muncul peringatan inkompatibel (jika fitur ini ada) | P1 |
| GST-503 | Harga live | Bandingkan harga komponen di builder vs katalog | Identik — harga diambil live dari katalog, bukan snapshot basi | P0 |
| GST-504 | Simpan rakitan sebagai guest | Klik "Simpan rakitan" tanpa login | Diarahkan ke login/register dengan return URL; setelah login rakitan **tidak hilang** | P0 |
| GST-505 | Kirim rakitan via WA | Klik share/pesan rakitan via WA | Pesan memuat harga per komponen dan total. Diuji: tiap angka sama dengan halaman produk; `prepareBuildWhatsApp` menghitung ulang di server | P0 |
| GST-506 | Reset builder | Klik reset | Semua slot bersih, total kembali 0 | P2 |

## 1.6 Toko Fisik / Store Locator — `GST-6xx`

| ID | Skenario | Langkah | Expected Result | Prio |
|---|---|---|---|---|
| GST-601 | Layout dua panel | Buka `/stores` di desktop | Panel daftar cabang + panel peta tampil sesuai desain | P0 |
| GST-602 | Data cabang dari DB | Ubah alamat/telepon cabang di admin → refresh | Nilai ikut berubah (tidak hardcode) | P0 |
| GST-603 | Peta Leaflet | Zoom, pan, klik marker Gateway Mall & Nagoya Hill | Marker benar posisi, popup berisi info cabang, tidak ada tile error | P1 |
| GST-604 | Pilih cabang | Klik cabang di panel kiri | Peta pan/zoom ke cabang tsb, state aktif tersorot | P1 |
| GST-605 | Jam buka per cabang | Bandingkan dengan jadwal di DB | Status "Buka/Tutup" akurat menurut WIB, termasuk saat jam istirahat / hari libur | P1 |
| GST-606 | Tombol arah | Klik "Petunjuk arah" | Membuka Google Maps dengan koordinat cabang yang benar | P1 |
| GST-607 | Responsif mobile | Buka di 360px | Peta tidak overflow, panel jadi stack, peta punya tinggi yang wajar | P1 |
| GST-608 | Leaflet & SSR | Hard refresh halaman | Tidak ada error `window is not defined`; peta di-load dinamis client-side | P0 |

## 1.7 Checkout / Inquiry Guest — `GST-7xx`

> Sesuaikan bila alur order akhir memang lewat WhatsApp, bukan payment gateway.

| ID | Skenario | Langkah | Expected Result | Prio |
|---|---|---|---|---|
| GST-701 | Gating checkout | Guest klik checkout | Perilaku sesuai keputusan produk: (a) diminta login, atau (b) guest checkout dengan form data diri — konsisten, tidak setengah-setengah | P0 |
| GST-702 | Return URL | Login dari gating checkout | Setelah login kembali ke halaman checkout, keranjang utuh | P0 |
| GST-703 | Validasi form | Submit form kosong / email salah format / no HP huruf | Error per-field jelas dalam Bahasa Indonesia, fokus ke field pertama yang error | P0 |
| GST-704 | Double submit | Klik submit 2x cepat | Hanya 1 order/inquiry terbuat; tombol disabled saat proses | P0 |
| GST-705 | Payload eksternal | Inspect network saat submit ke WA/pihak ketiga | Klien mengirim **id produk + qty saja**; harga dirakit di server. Yang dilarang: klien mengirim angka harga untuk dipakai apa adanya | P0 |
| GST-706 | Konfirmasi | Selesaikan alur | Ada halaman/pesan konfirmasi + nomor referensi | P1 |

## 1.8 Halaman Statis & SEO Guest — `GST-8xx`

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| GST-801 | Halaman Tentang / Kebijakan / Garansi / FAQ | Konten dari DB/CMS, bukan hardcode; tidak ada lorem ipsum tersisa | P1 |
| GST-802 | `robots.txt` staging | `store.hnsitcenter.id/robots.txt` berisi `Disallow: /` | P0 |
| GST-803 | `robots.txt` production | Mengizinkan crawl, menunjuk sitemap yang benar | P0 |
| GST-804 | `sitemap.xml` | Berisi URL produk & kategori aktif, tanpa URL admin/staging | P1 |
| GST-805 | Canonical | Halaman terfilter/pagination punya canonical yang benar | P2 |

---

# 2. REGISTRASI & AUTENTIKASI — `AUT-xxx`

## 2.1 Registrasi Email + Password

| ID | Skenario | Langkah | Expected Result | Prio |
|---|---|---|---|---|
| AUT-101 | Registrasi sukses | Daftar dengan `TD-01` | Akun dibuat status **belum terverifikasi**, email verifikasi terkirim, user diarahkan ke halaman "cek email" | P0 |
| AUT-102 | Email duplikat | Daftar ulang dengan email yang sudah ada | Pesan error netral (jangan bocorkan apakah email terdaftar — atau ikuti kebijakan produk yang disepakati) | P0 |
| AUT-103 | Password lemah | Coba `123456`, `abc` | Ditolak, aturan password ditampilkan sebelum submit | P0 |
| AUT-104 | Validasi server-side | Kirim request POST langsung (Postman) melewati validasi client | Server tetap menolak input invalid | P0 |
| AUT-105 | Password di-hash | Cek tabel `customers` di DB | Format `salt:hash` heksadesimal dari **`scrypt`** (`lib/auth/password.ts`) — bukan bcrypt/argon2, dan bukan plaintext | P0 |
| AUT-106 | Rate limiting | Kirim 20 request registrasi beruntun | Diblok/throttled setelah ambang batas | P1 |
| AUT-107 | Email deliverability | Cek inbox Gmail, Outlook, Yahoo | ⚠️ Masuk **Inbox**, bukan Spam. Cek header: SPF `pass`, DKIM `pass`, DMARC aligned dengan `hnsitcenter.id` (blocker yang sedang dikerjakan — Hostinger SMTP) | P0 |

## 2.2 Verifikasi Email

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| AUT-201 | Klik link verifikasi valid | Akun jadi terverifikasi, auto-login atau diarahkan ke login dengan pesan sukses | P0 |
| AUT-202 | Link dipakai 2x | Percobaan kedua: pesan "sudah terverifikasi", bukan error 500 | P1 |
| AUT-203 | Token kedaluwarsa | Pesan jelas + tombol "kirim ulang" | P0 |
| AUT-204 | Token dimodifikasi | Ditolak, tidak ada informasi bocor | P0 |
| AUT-205 | Login sebelum verifikasi (`TD-03`) | Ditolak/dibatasi sesuai kebijakan, dengan opsi kirim ulang email | P0 |
| AUT-206 | Kirim ulang berulang | Ada rate limit / cooldown pada tombol kirim ulang | P1 |

## 2.3 Login Email + Password

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| AUT-301 | Login valid | Masuk, redirect ke `/profile` atau halaman asal | P0 |
| AUT-302 | Password salah | Pesan error generik "email atau password salah" (jangan spesifik) | P0 |
| AUT-303 | Email tidak terdaftar | Pesan sama persis dengan AUT-302 (cegah user enumeration) | P0 |
| AUT-304 | Brute force | 10 percobaan gagal → lockout/throttle sementara | P1 |
| AUT-305 | Session cookie | Inspect cookie | `HttpOnly`, `Secure`, `SameSite=Lax/Strict` | P0 |
| AUT-306 | Session persist | Refresh & buka tab baru | Tetap login | P0 |
| AUT-307 | Session expiry | Tunggu/ubah expiry | Setelah kadaluarsa diarahkan ke login, bukan halaman error | P1 |

## 2.4 Google OAuth

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| AUT-401 | OAuth user baru (`TD-04`) | Akun dibuat, nama & foto profil terisi, langsung terverifikasi | P0 |
| AUT-402 | OAuth user lama | Login ke akun yang sama, **tidak** membuat duplikat | P0 |
| AUT-403 | Satu jalur identitas (`TD-05`) | **Sudah diputuskan** (`prisma/schema.prisma`, model `Customer`): daftar manual dengan email yang sudah terdaftar lewat Google **ditolak** dan diarahkan pakai Google. Bukan auto-link | P0 |
| AUT-404 | Batal di consent screen | Kembali ke halaman login dengan pesan ramah, bukan error page | P1 |
| AUT-405 | Redirect URI | Uji di local, staging, production | Semua redirect URI terdaftar di Google Cloud Console; tidak ada `redirect_uri_mismatch` | P0 |
| AUT-406 | State/CSRF | Manipulasi parameter `state` | Request ditolak | P0 |

## 2.5 Logout, Lupa Password, Ganti Password

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| AUT-501 | Logout | Session dihapus; tekan tombol Back browser **tidak** menampilkan halaman terproteksi dari cache | P0 |
| AUT-502 | Lupa password — email ada | Email reset terkirim, respons UI netral | P0 |
| AUT-503 | Lupa password — email tidak ada | Respons UI **sama persis** (cegah enumeration) | P0 |
| AUT-504 | Reset token sekali pakai | Setelah dipakai, token invalid | P0 |
| AUT-505 | Reset password | Semua session lama ter-invalidate | P1 |
| AUT-506 | Ganti password (login) | Wajib masukkan password lama | P0 |
| AUT-507 | Akun OAuth-only ganti password | Ditangani dengan benar (opsi set password atau disembunyikan) | P1 |

## 2.6 Proteksi Route

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| AUT-601 | Guest akses `/profile` | Redirect ke login + return URL | P0 |
| AUT-602 | Guest akses `/admin` | Redirect/403, **tidak** flash konten admin sekejap | P0 |
| AUT-603 | Guest hit API terproteksi (Postman) | 401, tidak ada data bocor | P0 |
| AUT-604 | Customer hit API admin | 403 | P0 |

---

# 3. ALUR CUSTOMER TERDAFTAR — `CUS-xxx`

## 3.1 Profil

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| CUS-101 | Buka `/profile` | Data akun tampil benar (nama, email, tanggal daftar) | P0 |
| CUS-102 | Edit profil | Perubahan tersimpan & persist setelah refresh | P0 |
| CUS-103 | Validasi edit | Nama kosong, no HP invalid → ditolak client & server | P0 |
| CUS-104 | Ganti email | Wajib verifikasi email baru sebelum berlaku | P1 |
| CUS-105 | Upload avatar | Batas ukuran & tipe file ditegakkan; file `.php`/`.svg` berbahaya ditolak | P1 |
| CUS-106 | Redirect legacy | Akses `/account` (nama lama; **bukan** `/akun`) | Redirect ke `/profile`. Uji juga `/profile/lengkapi-profil`, yang wajib dilewati akun Google baru | P1 |
| CUS-107 | Hapus akun sendiri | Jika fitur ada: konfirmasi ganda, data ditangani sesuai kebijakan | P2 |

## 3.2 Rakitan Tersimpan (Saved PC Builds)

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| CUS-201 | Simpan rakitan | Muncul di daftar rakitan tersimpan dengan nama & timestamp | P0 |
| CUS-202 | Harga live | Admin ubah harga komponen di `TD-10` → buka rakitan tersimpan | Total ter-update ke harga katalog terkini | P0 |
| CUS-203 | Komponen dinonaktifkan | Admin nonaktifkan salah satu komponen → buka rakitan | Ditandai "tidak tersedia", total tidak NaN/error | P0 |
| CUS-204 | Komponen dihapus dari katalog | Rakitan tetap bisa dibuka, item hilang ditangani secara graceful | P0 |
| CUS-205 | Edit rakitan | Ubah komponen → simpan | Perubahan persist, tidak membuat duplikat entri | P1 |
| CUS-206 | Duplikat rakitan | Rakitan baru terbuat terpisah dari aslinya | P2 |
| CUS-207 | Hapus rakitan | Ada konfirmasi; terhapus permanen dari daftar | P1 |
| CUS-208 | **Otorisasi (IDOR)** | Login sebagai user B, akses URL/API rakitan milik user A | **403/404 — data user lain tidak boleh terbaca** | P0 |
| CUS-209 | Rakitan → keranjang | Klik "Masukkan semua ke keranjang" | Semua komponen tersedia masuk, qty benar | P1 |
| CUS-210 | Share rakitan via WA | Harga ikut, dan sama dengan katalog. Ubah harga produk di admin → ulangi share → angkanya ikut berubah | P0 |

## 3.3 Keranjang & Migrasi dari Guest

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| CUS-301 | Merge keranjang | 🚫 **N/A — fitur belum ada.** Keranjang murni localStorage; tidak ada keranjang milik akun untuk di-merge | — |
| CUS-302 | Keranjang lintas device | 🚫 **N/A — fitur belum ada.** Butuh keranjang tersimpan di DB — belum ada | — |
| CUS-303 | Keranjang setelah logout | 🚫 **N/A — fitur belum ada.** Alasan sama seperti CUS-301 | — |

## 3.4 Riwayat Pesanan / Inquiry

> 🚫 **N/A — fitur belum ada.** **Tidak ada model `Order` di `prisma/schema.prisma`.** Pesanan berakhir
> sebagai pesan WhatsApp ke CS dan tidak tersimpan di sistem. Seluruh test case di
> bagian ini tidak bisa dieksekusi — dibiarkan tertulis sebagai backlog, bukan
> dihapus, supaya kebutuhannya tidak hilang dari ingatan.

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| CUS-401 | Daftar pesanan | Menampilkan pesanan milik user tsb saja, urut terbaru | P0 |
| CUS-402 | Detail pesanan | 🚫 **N/A — fitur belum ada.** Tidak ada snapshot harga karena tidak ada transaksi tersimpan | — |
| CUS-403 | **IDOR pesanan** | Akses ID pesanan milik user lain | 403/404 | P0 |
| CUS-404 | Belum ada pesanan | Empty state + CTA ke katalog | P2 |
| CUS-405 | Status berubah | Admin ubah status → refresh di sisi customer | Status ter-update | P1 |

## 3.5 Alamat (jika ada)

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| CUS-501 | Tambah alamat | Tersimpan, tampil di daftar | P1 |
| CUS-502 | Set alamat utama | Hanya 1 alamat utama pada satu waktu | P1 |
| CUS-503 | Hapus alamat utama | Ditangani dengan benar (auto-assign atau blokir dengan pesan) | P2 |

---

# 4. ALUR ADMIN — `ADM-xxx`

## 4.1 Akses & RBAC (owner vs staff)

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| ADM-101 | Login owner (`TD-06`) | Masuk dashboard, seluruh menu terlihat | P0 |
| ADM-102 | Login staff (`TD-07`) | Masuk dashboard, menu terbatas sesuai matriks izin | P0 |
| ADM-103 | **Staff hapus customer** | Menu/tombol tidak tampil **DAN** endpoint API menolak dengan 403 bila dipanggil langsung | P0 |
| ADM-104 | Enumerasi route admin | Staff akses URL halaman khusus owner secara manual | 403/redirect, bukan render halaman | P0 |
| ADM-105 | Customer biasa akses `/admin` | Diblokir total | P0 |
| ADM-106 | Escalation via API | Customer coba PATCH role dirinya jadi admin | Ditolak; field `role` tidak boleh mass-assignable | P0 |
| ADM-107 | Session admin | Timeout lebih ketat dari customer (jika didefinisikan) | P2 |

> **Catatan:** buat matriks izin eksplisit (owner vs staff) dan lampirkan sebagai `docs/qa/RBAC-MATRIX.md`. Setiap sel matriks = 1 test case negatif.

## 4.2 Manajemen Produk

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| ADM-201 | Buat produk | Tersimpan, langsung tampil di katalog publik (jika status aktif) | P0 |
| ADM-202 | Validasi form produk | Harga negatif, stok huruf, nama kosong, SKU duplikat → ditolak di server juga | P0 |
| ADM-203 | Upload gambar | Batas ukuran & MIME ditegakkan; gambar tampil di frontend | P0 |
| ADM-204 | Edit produk | Perubahan langsung tercermin di katalog, detail, keranjang, dan rakitan tersimpan | P0 |
| ADM-205 | Nonaktifkan produk | Hilang dari katalog publik; akses langsung URL → 404 | P0 |
| ADM-206 | Hapus produk | 🚫 **N/A — fitur belum ada.** untuk bagian "terkait pesanan" — tidak ada tabel pesanan. Yang tetap diuji: produk terhapus hilang dari katalog & halaman paket PC Prebuild menandainya | P1 |
| ADM-207 | Update stok | Nilai baru muncul di frontend, produk stok 0 tidak bisa dicheckout | P0 |
| ADM-208 | Update harga | Harga baru dipakai di katalog, keranjang aktif, dan rakitan tersimpan | P0 |
| ADM-209 | Bulk action | Aktif/nonaktif massal → semua item terproses, tidak ada partial silent failure | P1 |
| ADM-210 | XSS di field deskripsi | Isi `<img src=x onerror=alert(1)>` → lihat di frontend | Ter-sanitize, tidak tereksekusi | P0 |
| ADM-211 | Pencarian & filter admin | Bekerja pada dataset besar; pagination stabil | P1 |
| ADM-212 | **Kuota koneksi Hostinger** | Jalankan operasi bulk/import besar | ⚠️ Tidak memicu ledakan koneksi; gunakan batching + connection pooling. Pantau agar tidak menembus limit 500 koneksi/jam | P0 |

## 4.3 Kategori, Brand, Master Data

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| ADM-301 | CRUD kategori | Tersimpan; slug unik; muncul di filter publik | P0 |
| ADM-302 | Hapus kategori berisi produk | Dicegah atau produk direassign — tidak boleh jadi orphan | P0 |
| ADM-303 | Kategori bertingkat | Hierarki benar di admin & frontend | P1 |
| ADM-304 | Urutan tampil | Sorting/priority tersimpan & terpakai di frontend | P2 |

## 4.4 Manajemen Pesanan

> 🚫 **N/A — fitur belum ada.** Alasan sama seperti §3.4: tidak ada model `Order`. Panel admin tidak punya
> layar pesanan, dan tidak akan punya sampai modulnya dibangun.

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| ADM-401 | Daftar pesanan | Semua pesanan tampil, filter status & tanggal bekerja | P0 |
| ADM-402 | Detail pesanan | Item, harga snapshot, data customer, riwayat status lengkap | P0 |
| ADM-403 | Ubah status | Tersimpan, tercermin di sisi customer, tercatat siapa yang mengubah | P0 |
| ADM-404 | Transisi status invalid | Misal "selesai" → "menunggu bayar" dicegah sesuai state machine | P1 |
| ADM-405 | Efek stok | 🚫 **N/A — fitur belum ada.** Stok tidak pernah dipotong otomatis karena pesanan tidak tercatat di sistem | — |
| ADM-406 | Export | File terunduh, kolom & encoding (UTF-8) benar; formula injection CSV dicegah | P2 |

## 4.5 Manajemen Customer

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| ADM-501 | Daftar customer | Tampil dengan pagination & pencarian | P0 |
| ADM-502 | Detail customer | Data profil + ringkasan pesanan; **password tidak pernah ditampilkan/dikirim ke client** | P0 |
| ADM-503 | Hapus customer (owner) | **Sudah diputuskan** (CLAUDE.md §2.8): **hard delete**, cascade ke rakitan tersimpan — bukan anonymize. Yang WAJIB diuji: `sessionsRevokedAt` terisi **sebelum** barisnya hilang, lalu cookie yang sudah beredar benar-benar mati (uji dengan cookie lama di tab lain) | P0 |
| ADM-504 | Hapus customer (staff) | **Ditolak — UI dan API** (lihat ADM-103) | P0 |
| ADM-505 | Integritas setelah hapus | Rakitan tersimpan milik customer ikut terhapus lewat `onDelete: Cascade`; `customer_deletion_logs` bertambah satu baris **tanpa** memuat email/nama; halaman lain tidak error 500 | P0 |
| ADM-506 | Owner hapus dirinya sendiri | Dicegah, atau minimal cegah kondisi "tidak ada owner tersisa" | P0 |
| ADM-507 | Nonaktifkan (bukan hapus) | Jika ada: user tidak bisa login lagi, data tetap utuh | P1 |

## 4.6 Konten & Pengaturan Toko

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| ADM-601 | Ubah jam operasional cabang | Tercermin di `/stores` — **membuktikan tidak ada hardcode**. Sejak 19 Agt 2026 `/about` dan `/contact` hanya menautkan ke sana, tidak lagi mengulang datanya | P0 |
| ADM-602 | Ubah alamat & koordinat cabang | Marker Leaflet pindah sesuai koordinat baru | P0 |
| ADM-603 | Ubah nomor WhatsApp | Semua tombol WA di frontend memakai nomor baru | P0 |
| ADM-604 | Ubah halaman kebijakan | Konten publik ikut berubah | P1 |
| ADM-605 | Hari libur / tanggal khusus | Status buka/tutup akurat pada tanggal tsb (uji dengan mengubah tanggal sistem/mock) | P1 |

## 4.7 Audit & Observability

| ID | Skenario | Expected Result | Prio |
|---|---|---|---|
| ADM-701 | Audit log aksi destruktif | Hapus produk/customer & ubah harga tercatat: siapa, apa, kapan | P1 |
| ADM-702 | Log tidak bocorkan rahasia | Log tidak memuat password, token, atau secret | P0 |
| ADM-703 | Error handling | Aksi gagal menampilkan pesan bermakna, bukan stack trace mentah ke user | P1 |

## 4.8 Area Admin yang Belum Punya Test Case — `ADM-8xx`

Ditambahkan 19 Agustus 2026. Layar-layar ini hidup di panel admin tapi tidak
tersentuh versi pertama dokumen ini. Belum dirinci per test case; minimal
dieksekusi sebagai smoke test sampai ada yang menuliskannya.

| ID | Layar | Minimal yang diuji | Prio |
|---|---|---|---|
| ADM-801 | `/admin/banner` | Tambah/ubah/hapus banner promo; tercermin di beranda | P1 |
| ADM-802 | `/admin/theme` + `/admin/colors` | Ganti tema → berlaku di **seluruh** halaman termasuk `/build-pc`; "kembali ke default" benar-benar kembali | P1 |
| ADM-803 | `/admin/kebijakan` + FAQ | Ubah isi → tampil di `/kebijakan/*` dan `/faq`; halaman induk `/kebijakan` tidak 404 | P1 |
| ADM-804 | `/admin/atribut-brand` | Tambah atribut & nilai; dipakai varian produk dan filter shop | P1 |
| ADM-805 | `/admin/pc-builder` | Tambah/hapus/urutkan langkah → tercermin di `/build-pc` | P0 |
| ADM-806 | `/admin/pc-prebuild` | Sakelar mati → `/pc-prebuild` melempar ke `/build-pc` & menu hilang. Susun paket → muncul di kartu, "Pakai rakitan ini" memuat wizard | P1 |
| ADM-807 | `/admin/logs` | Aksi destruktif tercatat; log tidak memuat email/nama pelanggan | P1 |
| ADM-808 | `/admin/akun` | Ubah role owner/staff berlaku seketika pada izin | P0 |
| ADM-809 | Import & `ImportQuarantine` | Baris cacat masuk karantina, tidak diam-diam hilang | P1 |

---

# 5. CROSS-CUTTING — `XCT-xxx`

## 5.1 Keamanan (OWASP Top 10)

| ID | Uji | Expected | Prio |
|---|---|---|---|
| XCT-101 | SQL/NoSQL Injection di semua input | Prisma parameterized; tidak ada raw query tanpa binding | P0 |
| XCT-102 | Stored & Reflected XSS | Semua output ter-escape; hindari `dangerouslySetInnerHTML` tanpa sanitizer | P0 |
| XCT-103 | CSRF pada semua mutasi | Token/SameSite melindungi POST/PATCH/DELETE | P0 |
| XCT-104 | IDOR menyeluruh | Semua endpoint by-ID memeriksa kepemilikan (lihat CUS-208, CUS-403) | P0 |
| XCT-105 | Security headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS terpasang | P0 |
| XCT-106 | Secret leakage | Tidak ada API key/DB URL di bundle client; cek `.next/static` | P0 |
| XCT-107 | Rate limiting | Login, register, reset password, dan endpoint search dilindungi | P1 |
| XCT-108 | ⚠️ **Harga dihitung di klien** | Grep kode client untuk perkalian/persentase atas harga (§2.7) — **harus nihil**. Menampilkan harga katalog dan menjumlahkannya boleh; menurunkan harga baru dari rumus tidak | P0 |
| XCT-109 | Dependency audit | `npm audit` tanpa vulnerability high/critical | P1 |
| XCT-110 | HTTPS & redirect | HTTP → HTTPS 301; tidak ada mixed content | P0 |

## 5.2 Performa

| ID | Uji | Target | Prio |
|---|---|---|---|
| XCT-201 | Lighthouse mobile — Home, Katalog, Detail Produk | Performance ≥ 80, LCP < 2.5s, CLS < 0.1 | P1 |
| XCT-202 | Ukuran bundle | Tidak ada regresi besar; Leaflet & chart di-lazy load | P1 |
| XCT-203 | Query N+1 | Cek log Prisma pada listing katalog & daftar pesanan | P0 |
| XCT-204 | Index database | Kolom slug, SKU, email, foreign key, dan kolom filter ter-index | P0 |
| XCT-205 | Optimasi gambar | Pakai `next/image`, format modern, ukuran wajar | P1 |
| XCT-206 | Koneksi Hostinger | Setelah 1 jam pemakaian normal + 1 build, koneksi tidak mendekati limit | P0 |

## 5.3 Responsif, Aksesibilitas, Lokalisasi

| ID | Uji | Expected | Prio |
|---|---|---|---|
| XCT-301 | Semua halaman di 360px | Tidak ada horizontal scroll, tidak ada teks terpotong | P1 |
| XCT-302 | Navigasi keyboard | Semua aksi bisa dijangkau Tab/Enter; focus ring terlihat | P1 |
| XCT-303 | Kontras warna | Memenuhi WCAG AA | P2 |
| XCT-304 | Alt text | Semua gambar produk punya alt bermakna | P2 |
| XCT-305 | Format Rupiah | `formatRupiah()` memakai **NBSP (U+00A0)** setelah `Rp`, bukan spasi biasa. Skrip uji yang membandingkan dengan spasi ASCII akan gagal padahal tampilannya benar. Tidak ada desimal ganjil atau `NaN` | P0 |
| XCT-306 | Tanggal & waktu | Selalu `Asia/Jakarta`, format Indonesia, tidak ada hydration mismatch | P0 |
| XCT-307 | Bahasa | Pesan error & label konsisten Bahasa Indonesia, tidak campur bahasa Inggris default framework | P1 |

---

# 6. SMOKE TEST (regression cepat ± 15 menit)

Jalankan setiap kali sebelum deploy:

- [ ] Homepage load, tidak ada error console
- [ ] Katalog tampil + filter kategori bekerja
- [ ] Detail produk tampil, harga benar
- [ ] Tombol WhatsApp → pesan memuat harga, dan angkanya **sama dengan halaman produk**
- [ ] Tambah ke keranjang + ubah qty
- [ ] Register akun baru → email verifikasi masuk **Inbox**
- [ ] Login email+password berhasil
- [ ] Login Google OAuth berhasil
- [ ] `/profile` tampil, edit tersimpan
- [ ] Rakitan tersimpan terbuka dengan harga live
- [ ] `/stores` peta tampil, kedua cabang benar
- [ ] Login admin owner → dashboard tampil
- [ ] Login admin staff → tombol hapus customer **tidak ada**
- [ ] Edit produk di admin → berubah di frontend
- [ ] Guest akses `/admin` → diblokir
- [ ] Staging `robots.txt` masih `Disallow: /`

---

# 7. Template Laporan Bug

```
ID          : BUG-YYYYMMDD-nn
Judul       : [Area] ringkasan singkat masalah
Test Case   : GST-306 (jika berasal dari test case)
Severity    : S1 / S2 / S3 / S4
Environment : Local / Staging / Production
Browser     : Chrome 1xx / Safari iOS 17 — viewport 390px
Akun        : TD-02 (customer terverifikasi)

Langkah Reproduksi:
1.
2.
3.

Expected  :
Actual    :
Bukti     : screenshot / video / HAR / log konsol
Frekuensi : selalu / kadang (x dari y percobaan)
Dugaan penyebab :
```

---

# 8. Kandidat Otomasi (Playwright) — Prioritas

Urutan pengerjaan bila alur ini akan diotomasi:

| Prioritas | Spec | Test case yang dicakup |
|---|---|---|
| 1 | `auth.spec.ts` | AUT-101, 201, 301, 302, 401, 601, 602 |
| 2 | `guest-catalog.spec.ts` | GST-201, 203, 209, 210, 301, 305 |
| 3 | `cart.spec.ts` | GST-401→409, CUS-301 |
| 4 | `rbac.spec.ts` | ADM-103, 104, 105, CUS-208, CUS-403 (paling bernilai — murni assertion API) |
| 5 | `saved-builds.spec.ts` | CUS-201→208 |
| 6 | `whatsapp-payload.spec.ts` | GST-306, GST-505, CUS-210 — assert harga di URL WA **sama dengan harga katalog**; XCT-108 — assert klien tidak menurunkan harga dari rumus |

Rekomendasi teknis:
- Gunakan Playwright dengan `storageState` per peran (guest / customer / staff / owner) agar login tidak diulang di tiap test.
- Seed database melalui skrip Prisma khusus test, bukan lewat UI.
- Jalankan `rbac.spec.ts` dan `whatsapp-payload.spec.ts` di CI sebagai **gate wajib** — keduanya menjaga dua aturan bisnis paling kritis.

---

# 9. Exit Criteria Rilis

- 100% test case **P0** dieksekusi dan lulus
- ≥ 90% test case **P1** lulus, sisanya punya tiket dan tanggal target
- 0 bug **S1** terbuka; **S2** hanya boleh terbuka dengan persetujuan eksplisit Developer Hns
- Smoke test (§6) lulus di staging **dan** sekali lagi setelah deploy production
- Backup database diambil sebelum deploy, rollback plan tertulis

---

## Asumsi yang Perlu Dikonfirmasi

Beberapa bagian dokumen ini berdasarkan asumsi. Mohon dikoreksi bila keliru:

1. Alur order berakhir di **WhatsApp**, bukan payment gateway. Bila sudah ada gateway, dibutuhkan bagian test terpisah (pembayaran, webhook, refund, idempotency).
2. Guest **bisa** menambah ke keranjang tetapi **wajib login** untuk menyelesaikan checkout.
3. Modul manajemen pesanan di admin sudah ada. Bila belum, §4.4 dan §3.4 ditunda.
4. Alamat pengiriman & ongkir belum termasuk lingkup (toko fisik/pickup).
5. Role admin hanya `owner` dan `staff`, tanpa permission granular.
