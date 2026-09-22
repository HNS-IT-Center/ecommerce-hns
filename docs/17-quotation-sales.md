# Quotation Rakitan PC: Nomor Urut, Sales & CS, Revisi, Closing

> Baca ini sebelum menyentuh apa pun yang berhubungan dengan quotation rakitan PC:
> `/build-pc/print`, `/verify`, `/profile/quotation`, `/admin/quotation`, atau tabel
> `pc_build_quotes` dan turunannya.

Sampai 21 September 2026 quotation adalah **dokumen anonim yang tidak bisa diubah**: kodenya
diturunkan dari hash isi rakitan, tidak punya pemilik, dan diterbitkan sebagai efek samping
membuka halaman cetak. Dokumen ini menjelaskan apa yang menggantikannya dan — yang lebih
penting — **kenapa**, supaya aturan-aturan di bawah tidak "dirapikan" kembali oleh orang yang
tidak tahu apa yang ditukar untuk mendapatkannya.

---

## 1. Kode & penomoran

Dua format beredar, dan **keduanya harus selamanya diterima** di `/verify`:

| Format | Contoh | Sejak |
|---|---|---|
| Nomor urut | `HNSPC-20260921-0001` | 21 Sep 2026 |
| Warisan (hash) | `HNSPC-260804-7K3M` | sebelumnya |

Polanya hidup di satu tempat: `QUOTE_CODE_PATTERN` (`src/app/verify/format.ts`).
Menyempitkannya berarti ratusan PDF yang sudah di tangan pelanggan ditolak sebagai "kode tidak
valid" oleh toko yang menerbitkannya sendiri.

**Nomor di-reset tiap bulan menurut WIB**, bukan waktu server. Container produksi berjalan di
UTC; tanpa penerjemahan itu, cetakan pukul 00.30 WIB tanggal 1 masuk periode bulan sebelumnya.
Konstantanya di `src/lib/utils/timezone.ts` — **jangan menyalin `"Asia/Jakarta"` ke tempat lain.**

Penomorannya **atomik**, satu transaksi dengan pembuatan barisnya:

```
INSERT INTO pc_build_quote_counters (period, last_number) VALUES (?, 1)
  ON DUPLICATE KEY UPDATE last_number = last_number + 1
SELECT last_number FROM pc_build_quote_counters WHERE period = ?
```

Bentuk itu dipilih dengan sadar, **bukan** `SELECT … FOR UPDATE` lalu `UPDATE`: pola
SELECT-lalu-UPDATE mengambil kunci berbagi dulu lalu menaikkannya jadi eksklusif, dan dua
penerbitan bersamaan atas baris yang sama akan deadlock. Diuji dengan 20 penerbitan serentak.

Nomor dan barisnya lahir di **satu** transaksi supaya insert yang gagal tidak meninggalkan
lubang permanen di urutan.

### Risiko yang diterima
1. **Volume bocor** — dua dokumen cukup untuk memperkirakan jumlah quotation per bulan.
2. **Counter bisa dipompa** — pengunjung menekan Print berkali-kali menghabiskan nomor.

Mitigasinya, dan keduanya harus tetap ada:
- Nomor **hanya** terbit lewat server action, tidak pernah lewat GET.
- **Rate limit per IP** untuk non-staff (bucket `quote_issue`). **Staff dikecualikan** — seluruh
  gerai keluar lewat satu IP NAT, jadi batas per-IP adalah jatah seisi toko, bukan per orang.

---

## 2. Penerbitan hanya lewat aksi, tidak pernah lewat GET

`/build-pc/print` sekarang **hanya membaca**. Ia menerima `?kode=` dan merender snapshot yang
tersimpan.

Ini bukan selera arsitektur. Selama halaman cetak menulis saat GET, setiap refresh tab PDF,
setiap pra-render, dan setiap bot yang menelusuri tautan ikut menulis. Itu bisa ditolerir saat
kodenya hash (paling banter baris duplikat) tapi tidak lagi saat kodenya nomor urut — **refresh
akan memakan nomor.**

Konsekuensi yang disengaja: membuka ulang alamat yang sama **selalu** memberi dokumen yang sama
persis, sampai ke rupiahnya. Itulah yang membuat PDF di tangan pelanggan bisa
dipertanggungjawabkan.

Tautan lama `?items=…` tidak lagi menerbitkan apa pun; ia mengarahkan orang kembali ke Rakit PC.

**Dua jalur menerbitkan nomor,** dan keduanya disengaja: tombol Print, dan "Kirim ke HNS"
(Konsultasi WA). Akibatnya pelanggan yang menekan keduanya mendapat **dua nomor** untuk rakitan
yang sama. Itu diterima — keduanya dua peristiwa berbeda (satu dokumen dibawa pulang, satu
prospek masuk ke CS).

---

## 3. Dedupe `content_hash` sudah DILEPAS

Dulu `content_hash` unik: dua orang yang merakit isi sama persis berbagi satu baris.

Itu tidak bisa bertahan begitu quotation punya pemilik, nama pelanggan, dan status jual — dua
penawaran untuk dua orang berbeda tidak boleh jadi satu dokumen hanya karena isinya kebetulan
sama. Kalau dedupe dipertahankan, quotation Sales A bisa "berubah pemilik" saat Sales B mencetak
rakitan identik, dan menandainya terjual menutup dua-duanya.

`content_hash` tetap dihitung dan diindeks (berguna untuk menjawab "rakitan ini pernah
ditawarkan ke siapa saja"), hanya tidak lagi menjadi kunci identitas.

**`cache()` di `recordPcBuildQuote` juga sudah dibuang.** Pembungkus itu ada untuk menahan render
ganda React saat halaman cetak masih menulis pada GET. Memasangnya kembali sekarang berbahaya: ia
akan diam-diam menyatukan dua penerbitan berbeda yang isinya kebetulan sama dalam satu request.

---

## 4. Peran & izin

Tiga kunci baru di `ADMIN_PAGES` (`src/lib/auth/permissions.ts`):

| Kunci | Halaman? | Arti |
|---|---|---|
| `quotation` | **Ya** — `/admin/quotation` | `view` = lihat semua + rekap. `edit` = **batalkan status terjual** |
| `quotation-terbit` | Tidak | Menerbitkan quotation bernama; punya `/profile/quotation` |
| `quotation-sales` | Tidak | Penanda SALES: muncul di daftar operan CS, namanya tercetak di PDF |

**Kenapa `quotation` dipakai untuk halaman admin dan bukan untuk halaman profil:**
`pageFromPathname` menurunkan kunci dari segmen setelah `/admin/`, jadi `/admin/quotation` wajib
berkunci `quotation`. Kalau kunci itu dipakai untuk halaman profil, setiap Sales yang boleh
melihat riwayatnya sendiri ikut lolos penjaga halaman admin.

### Konfigurasi peran di Manajemen User

| Peran | Izin |
|---|---|
| **Sales** | `quotation-terbit: edit` + `quotation-sales: edit` |
| **Customer Service** | `quotation-terbit: edit` (TANPA `quotation-sales`) |
| **Kasir** | `verify: edit` |
| **Owner/Admin** | + `quotation: edit` |

**CS jangan diberi `quotation-sales`.** Kalau diberi, ia muncul di daftar operannya sendiri dan
namanya tercetak sebagai Sales di PDF.

Ketiga kunci masuk `OPT_IN_PAGES` — **tidak ikut fallback owner/staff**. Tanpa itu, setiap staff
lama otomatis jadi "Sales" dan daftar operan CS berisi seluruh isi kantor.

Tiap izin punya keterangannya di `ADMIN_PAGE_DESCRIPTIONS`, tampil sebagai tooltip `?` di editor
peran. Tipenya `Record<AdminPage, string>` (bukan `Partial`), jadi menambah izin tanpa keterangan
gagal typecheck.

---

## 5. Kepemilikan & operan CS

| Kolom | Arti |
|---|---|
| `owner_user_id` | Siapa yang MEMEGANG. Menentukan riwayat siapa, dan siapa yang boleh merevisi |
| `created_by_user_id` | Siapa yang MENERBITKAN. Hanya diisi untuk staff |
| `sales_name` | SALINAN nama tampilan pemilik saat terbit — inilah yang dicetak |

- keduanya **sama** → sales menerbitkan untuk dirinya, atau CS memilih "tidak oper"
- keduanya **beda** → CS mengoper ke sales; inilah yang memunculkan badge "Dioper dari CS" dan
  memicu notifikasi

CS wajib memilih: salah satu Sales, **atau "Tidak oper"** secara eksplisit. Tidak ada nilai
bawaan — menebak berarti quotation mendarat di riwayat orang yang tidak pernah memintanya.
"Tidak oper" → CS jadi pemiliknya, `sales_name` NULL, dan **baris "Sales:" tidak tercetak di
PDF sama sekali** (CS memang bukan sales).

Kepemilikan diputuskan **di server** dari izin sesi (`resolveOwner` di
`features/builder/actions-quotation.ts`), bukan dari yang dikirim klien. Dialog di builder cuma
menentukan apa yang terlihat.

### Nama tampilan sales
`users.sales_display_name` — terpisah dari `name`. Akun boleh bernama "Tyo Dwi Prasetyo" tapi di
quotation tercetak "Tyo". Diatur sales sendiri di `/admin/akun` atau oleh owner di Manajemen User
→ tab Admin.

**Di-snapshot saat terbit.** Mengubahnya tidak mengubah dokumen yang sudah di tangan pelanggan.

---

## 6. Privasi: siapa melihat apa

| Data | Kasir (`/verify`) | Pemilik (`/profile/quotation`) | Admin (`/admin/quotation`) | PDF |
|---|---|---|---|---|
| Nama pelanggan | ✅ | ✅ | ✅ | ✅ |
| Nomor HP | ❌ | disamarkan di daftar, utuh di detail | ✅ | ❌ |
| Catatan internal | ❌ | ✅ | ✅ | ❌ |

**Kasir tidak melihat nomor HP dan catatan internal**, dan itu bukan kelalaian. Kasir cukup
mencocokkan orang yang berdiri di depan meja dengan dokumennya; nomor HP tidak menambah apa pun
pada pekerjaan itu, dan catatan internal ("masih banding harga") adalah percakapan tim yang tidak
seharusnya terbaca dari layar yang menghadap pelanggan.

Ditegakkan lewat `getQuoteStatusForCashier()` yang memang tidak meng-`select` kolom itu — **jangan
menambahkannya "supaya lengkap".**

Larangan lama tetap berlaku: **jangan pernah meng-`include` relasi `submissions`** pada jalur baca
quotation mana pun.

---

## 7. Revisi

Kode **tidak berubah**; yang bertambah nomor revisinya. Setiap versi utuh tersimpan di
`pc_build_quote_revisions`, dan **Rev. 1 ditulis bersamaan dengan penerbitan** supaya riwayatnya
lengkap sejak awal.

Aturan harganya — inti dari fitur ini:

- Komponen yang **sudah ada** di revisi sebelumnya **mempertahankan harganya**, kecuali sales
  mencentang "Gunakan harga terbaru". Pelanggan sudah memegang kertas dengan angka itu;
  menaikkannya diam-diam saat sales cuma menambah satu keping RAM adalah cara tercepat kehilangan
  kepercayaannya.
- Komponen yang **baru ditambahkan** selalu memakai harga katalog.

Klien mengirim **boolean**, tidak pernah rupiah (CLAUDE.md §2.7). Server yang memutuskan tiap
baris.

Syarat merevisi (ketiganya di `getQuotationForRevision`): kodenya ada, **`userId` adalah
pemiliknya**, dan statusnya masih `terbit`. CS yang sudah mengoper kehilangan hak revisi bersama
kepemilikannya. Quotation yang sudah terjual **terkunci**.

Di Mode Revisi, tombol **Konsultasi WA disembunyikan**: angka yang tampil boleh berbeda dari
katalog (itu memang gunanya revisi), sedangkan pesan ke CS selalu dibaca ulang dari katalog.
Navigasi antar langkah ("Lanjut"/"Kembali") tetap ada — itu bukan yang dipermasalahkan §2.7.

> ⚠️ **`fetchBuilderProductsByIds` TIDAK menyaring `status` dan tidak memeriksa `saleEndDate`.**
> Ia untuk menampilkan pilihan, bukan memutuskan apa yang boleh dijual. Ketersediaan dan harga
> katalog di loader `?quotation=` dibaca lewat `priceCartFromCatalog` — fungsi yang sama yang
> dipakai `reviseQuotation` di server — supaya panel dan penyimpanan tidak bisa berbeda pendapat.
> Tanpa ini, komponen yang sudah ditarik staf dari etalase tetap termuat, terlihat normal, lalu
> baru ditolak saat Simpan tanpa keterangan yang mana.

---

## 8. Status jual

`terbit` → `closing` ditandai **kasir** di `/verify/[code]` (`verify: edit`), dengan dialog
konfirmasi yang menyebut kode, revisi, nama pelanggan, dan total.

`markQuotationClosed` membawa `expectedRevision` di WHERE. Antara kasir membuka halaman dan
menekan tombol, sales bisa menyimpan revisi baru — tanpa penjaga itu kasir menutup penjualan atas
angka yang sudah bukan angka terakhir.

**Pembatalan hanya oleh admin** di `/admin/quotation` (`quotation: edit`), dengan **alasan
wajib**, tercatat di `pc_build_quote_status_logs`. Kasir yang menandai **tidak** bisa
menariknya kembali — kalau bisa, dialog konfirmasi di `/verify` berhenti jadi pengaman dan berubah
jadi formalitas.

Tabel log itu ada karena alasan struktural: tindakan ini mengurangi angka penjualan seorang sales,
dan tanpa jejak, satu-satunya yang tersisa adalah bahwa angkanya pernah lebih besar.

---

## 9. Rekap penjualan

Dihitung dari **`closed_at`**, bukan tanggal terbit. Quotation yang terbit Agustus lalu deal
September adalah penjualan **September**. Memakai tanggal terbit memindahkan capaian seseorang ke
bulan yang salah setiap kali penawaran butuh waktu — yang justru paling sering terjadi pada
rakitan mahal.

Aturan yang sama dipakai rekap di profil sales **dan** di `/admin/quotation`. Kalau keduanya
dihitung berlainan, percakapan yang menyusul bukan tentang penjualan melainkan tentang laporan
mana yang benar.

---

## 10. Notifikasi operan

Sales penerima operan mendapat toast **"Dapat operan Customer dari CS"** yang **tidak hilang
sendiri** (`timeout: 0`). Toast yang lenyap setelah lima detik terlewat oleh sales yang sedang
melayani pelanggan — padahal justru itu keadaan saat operan paling sering datang.

Status terbaca disimpan di **server** (`pc_build_quotes.handover_seen_at`), bukan localStorage:
operan yang datang saat sales belum login tetap sampai ketika ia login, dan yang sudah ditutup
tidak muncul lagi di perangkat lain.

Polling tiap 60 detik + saat tab kembali aktif, lewat `GET /api/quotation/operan-baru`.

**Dipasang di `/build-pc` dan `/profile/quotation`, BUKAN di root layout.** Alasannya bukan
kerapian: `src/app/layout.tsx` sengaja tidak menyentuh `cookies()` supaya halaman toko bisa tetap
statis/ISR. Membaca sesi di sana demi satu komponen akan membuat seluruh storefront dirender per
permintaan. Akibat yang diterima: sales yang sedang menelusuri katalog biasa belum melihat
toast-nya — operannya tidak hilang, ia menunggu.

---

## 11. Jebakan yang sudah pernah memakan waktu

1. **`npm run typecheck` TIDAK menangkap pelanggaran aturan `"use server"`.** Berkas itu hanya
   boleh mengekspor fungsi async; sebuah `export const` lolos tsc tapi mematikan seluruh aplikasi.
   Jalankan **`npm run build`** sebelum menganggap selesai. Nilai bersama antara server action dan
   komponen klien ditaruh di modul biasa — lihat `src/features/builder/quotation-constants.ts`.
2. **Restart dev server setelah migrasi.** Prisma Client di-cache di `globalThis`; tanpa restart
   Anda akan melihat `Unknown argument 'period'` pada kolom yang jelas-jelas sudah ada
   (docs/08 §5).
3. **`migrate diff` ikut mengusulkan `DROP TABLE accurate_products` dan `accurate_woo_mapping`.**
   Keduanya hidup dan dipakai; mereka cuma dikelola lewat SQL mentah, bukan model Prisma. **Buang
   dua baris itu dari setiap migrasi.**
4. **`/profile` melempar staff ke `lengkapi-profil`** karena `phone_number` memang NULL untuk
   admin. Sudah dikecualikan — jangan dikembalikan.
5. **`window.open` sesudah `await` diblokir popup blocker.** Tab disiapkan lebih dulu di dalam
   gestur klik lewat `prepareInternalOpen()`.

---

## Tab "PC Build Logs" dihapus dari `/admin/logs` (22 September 2026)

`/admin/logs` dulu punya tab ketiga yang membaca `pc_build_quotes` — tabel yang
sama dengan `/admin/quotation`. Isinya sudah seluruhnya tertutup di sana, dan
halaman Quotation & Penjualan punya yang tidak pernah ada di tab itu: pencarian
kode/nama/nomor HP, saringan per sales dan status, rekap penjualan bulanan, dan
pembatalan status Terjual.

Yang menentukan bukan soal mubazir, melainkan **izin**. Kedua halaman dijaga
kunci berbeda — `logs` dan `quotation`. Selama tab itu ada, siapa pun yang
diberi izin Logs ikut melihat seluruh nama pelanggan, nama sales, dan nilai
transaksi tanpa pernah diberi izin `quotation`. Pemisahan yang sengaja dibangun
jadi bocor lewat pintu samping, dan tidak ada di UI yang memperlihatkan bahwa
itu terjadi.

`?tab=pc-build` yang masih tersimpan di bookmark jatuh ke tab Produk, bukan ke
halaman kosong. `pc-build-logs-table.tsx` ikut dihapus.

## `/admin/quotation` berhalaman (22 September 2026)

Tabelnya dulu `take: 100` tanpa pagination. Itu bukan pengaman melainkan
pemotong senyap: begitu quotation ke-101 terbit, yang paling lama hilang dari
daftar tanpa satu pun tanda di layar — padahal halaman ini justru tempat orang
mencari quotation lama saat ada keluhan.

Sekarang `listQuotationsForAdmin()` menerima `page` dan mengembalikan
`{ rows, total, page, pageCount }`, dengan `ADMIN_QUOTATION_PAGE_SIZE = 25`.
Urutannya `createdAt desc` **plus `code` sebagai kunci kedua** — quotation yang
terbit pada detik yang sama (sales menerbitkan beberapa revisi berurutan) bisa
tersusun berbeda tiap query, dan pada daftar berhalaman itu berarti satu baris
muncul di dua halaman sementara baris lain tidak pernah muncul.

Formulir saringan dan pemilih periode sengaja tidak membawa `page`: menyaring
ulang selalu kembali ke halaman pertama, karena "halaman 7" dari saringan lama
tidak menunjuk apa pun setelah saringannya berganti.
