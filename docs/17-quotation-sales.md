# Quotation Rakitan PC: Nomor Urut, Sales & CS, Revisi, Closing

> Baca ini sebelum menyentuh apa pun yang berhubungan dengan quotation rakitan PC:
> `/build-pc/print`, `/q/[token]`, `/verify`, `/profile/quotation`, `/admin/quotation`, atau
> tabel `pc_build_quotes` dan turunannya.

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
quotation tercetak "Tyo". Diatur sendiri di **`/profile`** (kartu Profil Saya, bersama foto dan
nomor WhatsApp — §15) atau di `/admin/akun`, dan oleh owner di Manajemen User → tab Admin.

**Kolomnya untuk `quotation-terbit`, bukan `quotation-sales`** (dilonggarkan 23 September 2026).
Selama syaratnya `quotation-sales`, CS tidak pernah bisa mengaturnya — padahal pesan follow-up
WhatsApp memperkenalkan ORANG YANG MENEKAN TOMBOL, bukan sales yang tersnapshot di dokumen, jadi
pelanggan menerima pesan dari "Customer Service 2": nama akun, apa adanya. Yang tercetak di PDF
tidak ikut melonggar — baris "Sales:" diisi `sales_name`, dan itu tetap NULL untuk pemilik yang
bukan Sales.

Formulirnya dipasang di dua halaman karena sales sehari-hari hidup di `/profile/quotation`,
sedangkan kolomnya dulu hanya ada di panel admin. Kolom yang cuma hidup di satu tempat yang
jarang dibuka adalah kolom yang tidak pernah ditemukan orang yang membutuhkannya. Komponen dan
server action-nya SATU (`features/quotation/components/sales-display-name-form.tsx`), yang
diduplikasi hanya penempatannya.

**Di-snapshot saat terbit.** Mengubahnya tidak mengubah dokumen yang sudah di tangan pelanggan.

---

## 6. Privasi: siapa melihat apa

| Data | Kasir (`/verify`) | Pemilik (`/profile/quotation`) | Admin (`/admin/quotation`) | PDF | Tautan publik (`/q`) |
|---|---|---|---|---|---|
| Nama pelanggan | ✅ | ✅ | ✅ | ✅ | ✅ |
| Nomor HP | ❌ | disamarkan di daftar, utuh di detail | ✅ | ❌ | ❌ |
| Catatan internal | ❌ | ✅ | ✅ | ❌ | ❌ |
| Nomor WhatsApp sales | ❌ | ❌ | ❌ | ❌ | ✅ (di tautan wa.me, §15) |

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

## 12. Tautan publik `/q/<token>` (23 September 2026)

Alamat pendek yang diselipkan sales di pesan follow-up WhatsApp, supaya pelanggan bisa membuka
kembali rakitannya tanpa mencari PDF di riwayat chat:

```
https://hnsitcenter.id/q/k3f9m2qa
```

### Kenapa token acak, bukan `code`

**Ini bagian yang tidak boleh "dirapikan".** `/build-pc/print?kode=…` sudah publik sejak dulu —
tidak dijaga `src/proxy.ts`, tidak minta login. Selama kodenya hash (`HNSPC-260804-7K3M`) itu bisa
ditolerir: tidak ada yang bisa menebak dokumen orang lain. Sejak kodenya **nomor urut**, tahu satu
kode berarti tahu semuanya — naik-turunkan angka terakhirnya dan seluruh penawaran bulan itu
terbuka, lengkap dengan nama pelanggan dan nilai transaksinya.

Selama tautannya tidak pernah disebarkan, celah itu tidur. Begitu sales mulai mengirimnya lewat
WhatsApp, ia bangun. Karena itu yang disebarkan adalah `public_token`: 8 karakter acak
(`lib/utils/public-token.ts`), ≈40 bit, `randomInt` dari `node:crypto` — bukan `Math.random()`,
dan bukan turunan apa pun dari kodenya.

Panjangnya titik temu dua tuntutan yang berlawanan: cukup pendek supaya tidak terlihat
mencurigakan di WhatsApp (pemendek pihak ketiga seperti bit.ly justru sudah jadi penanda penipuan,
dan URL-nya ikut tersimpan di layanan luar), cukup lebar supaya menebaknya tidak masuk akal.
**Jangan memperpendeknya lagi** — turun ke 6 karakter memotong dua karakter tapi memangkas ruang
tebakan hampir seribu kali.

### Apa yang ditampilkan

Revisi **TERAKHIR**, bukan versi saat tautannya dikirim. Tautan ini alat follow-up — ia menjawab
"apa yang berlaku sekarang" — sedangkan yang beku adalah PDF di tangan pelanggan. Keduanya tidak
bertabrakan **selama halaman ini selalu menyebutkan nomor revisi dan tanggal harganya**, dan itu
wajib, bukan hiasan.

Tanggal harga diambil dari `createdAt` revisi terakhir, **bukan `updatedAt`**: `updatedAt` ikut
maju saat sales menandai DP, dan tanggal yang bergeser tanpa satu angka pun berubah membuat
"Harga per …" jadi bohong.

Lewat 30 hari, halaman menampilkan spanduk "hubungi sales untuk harga terbaru" — angkanya tetap
ditampilkan. Menyembunyikan total pada penawaran yang sudah tua justru memaksa pelanggan bertanya
hal yang sudah pernah dijawab.

### Yang menjaga batasnya

- `getQuoteByPublicToken()` **tidak meng-`select`** `customer_phone` dan `internal_note`. Sama
  seperti `getQuoteStatusForCashier()` — jangan menambahkannya "supaya lengkap". Yang membuka
  halaman ini bukan cuma pelanggan yang dikirimi tautannya, melainkan siapa pun yang tautannya
  diteruskan kepadanya. Larangan meng-`include` relasi `submissions` berlaku paling keras di sini.
- **Metadata Open Graph sengaja STATIS**, tanpa nama dan tanpa angka. WhatsApp menampilkan kartu
  pratinjau di setiap percakapan tempat tautan diteruskan, termasuk grup — judul dinamis
  "Penawaran Budi — Rp 24.500.000" membocorkan isinya tanpa siapa pun perlu membukanya.
- `robots: noindex` di halaman + `Disallow: /q` di `app/robots.ts`. Keduanya mencegah
  **penerbitan ke hasil pencarian**, bukan mencegah akses — yang menjaga akses hanyalah tokennya.
- Service worker tidak perlu disentuh: `public/sw.js` memang tidak pernah men-cache halaman
  maupun API (docs/14). Kalau aturan itu suatu hari dilonggarkan, `/q` harus tetap di luarnya.

### Halaman cetak ikut ditutup

`/build-pc/print` sekarang menuntut salah satu dari dua hal:

1. **sesi staff** dengan `quotation-terbit: edit` (mencetak ulang dari riwayat) atau
   `verify: view` (kasir di meja) — cukup `?kode=`, seperti sebelumnya; atau
2. **`?t=<token>`** yang cocok dengan kodenya — untuk pelanggan, yang tidak punya sesi apa pun.

Token sampai ke tangan pelanggan lewat tautan penawaran, atau langsung dari tombol Print di
builder: `issueQuotation()`/`reviseQuotation()` mengembalikan `{ code, token }` dan builder membuka
`?kode=…&t=…`. Tanpa itu, **pengunjung anonim tidak akan bisa membuka dokumen yang baru saja ia
terbitkan sendiri**.

> **Regresi yang diterima sadar:** bookmark `?kode=` telanjang milik pengunjung anonim berhenti
> bekerja dan berganti pesan yang menyuruhnya membuka tautan penawaran. PDF yang sudah beredar
> tidak terpengaruh — yang tercetak di dalamnya `/verify/<kode>`, bukan alamat halaman cetak.

### Baris lama

`public_token` nullable. Quotation yang terbit sebelum fitur ini di-backfill lewat
`scripts/backfill-quote-tokens.mts` (idempoten, `--apply` untuk menyimpan). Backfill-nya **tidak**
di dalam migrasi karena nilainya harus acak kriptografis per baris, dan yang tersedia di SQL cuma
`RAND()`. Sampai skripnya jalan, tautannya disembunyikan — bukan gagal.

---

## 13. Penanda DP (23 September 2026)

`dp_at` + `dp_by_user_id` di `pc_build_quotes`. Ditandai **pemilik** quotation dari
`/profile/quotation/<kode>`, dengan dialog konfirmasi.

### DP TIDAK mengunci harga, dan jangan dibuat begitu

Harga sudah terkunci sejak quotation **disimpan**: `items` adalah snapshot, dan tidak ada satu pun
jalur yang memutakhirkannya sendiri. Satu-satunya yang mengubah harga adalah sales sendiri, lewat
revisi. Penanda DP tidak menambah kunci apa pun — ia memberi tahu semua orang yang membuka dokumen
ini bahwa pelanggannya sudah membayar di muka.

**Karena itu DP bukan nilai `status`.** Rancangan pertama menambahkan `status = 'dp'` di antara
`terbit` dan `closing`; itu akan membuat setiap penjaga yang berbunyi `status: "terbit"` ikut
menolaknya — syarat revisi di `getQuotationForRevision`, WHERE di `reviseQuotation`, dan
`markQuotationClosed`. Akibatnya quotation ber-DP tidak bisa direvisi dan tidak bisa ditandai
terjual: persis kebalikan dari yang dibutuhkan, karena pelanggan yang sudah membayar DP justru
yang paling sering menambah satu komponen lagi sebelum barangnya dirakit.

Tidak dicatat di `pc_build_quote_status_logs`. Tabel itu ada untuk perubahan yang mengubah **angka
penjualan** seseorang; menandai DP tidak mengubah angka siapa pun, dan "siapa & kapan" sudah
terjawab oleh dua kolomnya. Pembatalan tandanya juga tidak butuh admin dan tidak butuh alasan
tertulis — bandingkan dengan pembatalan status Terjual, yang menuntut keduanya (§8).

Tidak ada **nominal** DP yang disimpan di mana pun. Konsekuensinya disengaja: tidak ada "sisa
bayar" yang bisa ditampilkan, termasuk ke kasir. Berapa yang sudah masuk tetap ditanyakan ke
sales-nya.

Tandanya terlihat di: detail quotation, daftar `/profile/quotation`, `/admin/quotation`,
`/verify/[code]` (kasir), dan tautan publik pelanggan.

---

## 14. Tombol "Gunakan Harga Terbaru" (23 September 2026)

Di `/profile/quotation/<kode>`, untuk pemilik, selama status masih `terbit`. Untuk kasus yang
paling sering terjadi pada rakitan mahal: penawaran dibuat, pelanggan pamit berpikir, lalu muncul
lagi tiga bulan kemudian tanpa pernah membayar DP.

`refreshQuotationPrices()` **memanggil ulang `reviseQuotation(..., useLatestPrices: true)`** dengan
komposisi komponen yang sama, bukan menulis sendiri. Jalur tulis kedua untuk pekerjaan yang sama
adalah tempat kedua aturan harga bisa berselisih. Hasilnya Rev. N+1 dengan
`usedLatestPrices = true`, jadi `/verify` tetap bisa menjelaskan kenapa angkanya berbeda dari
kertas yang dipegang pelanggan.

`selectionsDariSeed()` memetakan `stepName` di snapshot kembali ke `stepId` lewat konfigurasi
builder. Nama yang sudah tidak ada di konfigurasi jatuh ke `null` — komponennya **tetap ikut**,
hanya masuk kelompok "Komponen Lainnya". Membuangnya berarti menyegarkan harga diam-diam mengubah
isi rakitan.

Dialognya menyebut **angka** — total sekarang, total baru, selisihnya — dari `previewLatestPrices()`,
yang membaca katalog lewat `priceCartFromCatalog`, fungsi yang sama yang dipakai saat benar-benar
menyimpan. Angka di dialog dan angka yang tersimpan karena itu mustahil berbeda. Komponennya tidak
mengalikan atau mengurangi apa pun, ia cuma memformat (CLAUDE.md §2.7).

Tombolnya **tetap ada** pada quotation yang sudah ditandai DP; yang bertambah hanya satu baris
peringatan di dialog. DP adalah penanda, bukan penjaga — dan "DP masuk, lalu pelanggan ganti satu
komponen" adalah kejadian nyata, bukan kasus teoretis.

Komponen yang hilang dari katalog **membatalkan** penyegaran dengan pesan yang menyuruh membuka
Revisi di Builder — bukan dibuang diam-diam. Aturan yang sama sudah berlaku di penerbitan dan
revisi.

---

## 15. Profil staff & kontak sales (23 September 2026)

### Satu kartu profil di `/profile`, bukan tiga tempat

Foto, nama sales, nomor WhatsApp, username, dan password disunting di satu
kartu di `/profile` (`features/account/components/staff-profile-card.tsx`).
Email ditampilkan **read-only** dan sengaja tidak bisa diganti sendiri: ia kunci
sambungan antar cara login (lihat catatan model `User`), jadi menggantinya lewat
formulir profil berarti seseorang bisa memindahkan akunnya ke alamat yang bukan
miliknya lalu masuk lewat Google atas alamat itu.

Tiga formulir terpisah dalam satu kartu, dan pemisahannya disengaja: yang
pertama mengubah apa yang **dibaca pelanggan**, dua berikutnya mengubah **kunci
pintu**. Satu tombol Simpan untuk ketiganya berarti gagal mengganti password
ikut membatalkan perbaikan nomor telepon, dan yang menekannya tidak pernah tahu
mana yang tersimpan.

**Tidak ada kolom baru.** `image`, `phone_number`, `username`, dan
`sales_display_name` sudah lama ada di `users`. Yang berubah cuma arti satu di
antaranya: `phone_number` dulu berkomentar "pelanggan saja, NULL untuk admin",
sekarang ia juga nomor WhatsApp sales yang dihubungi pelanggan.

Foto diunggah ke R2 lewat `POST /api/admin/media`, satu-satunya jalur unggah di
project ini (CLAUDE.md §2.2). Server action **menolak URL yang bukan dari bucket
kita** (`NEXT_PUBLIC_R2_PUBLIC_URL`): medan itu dikirim klien, dan tanpa penjaga
tersebut foto profil berubah jadi pemuat konten pihak ketiga di setiap halaman
yang menampilkannya — satu alamat milik orang lain, dimuat peramban staff,
lengkap dengan IP dan waktu bukanya.

**Memilih berkas tidak langsung mengunggah** — ia membuka `AvatarCropper`:
bingkai lingkaran yang bisa digeser dan di-zoom. Yang keluar 512×512 WebP dengan
**sudut benar-benar transparan**, bukan foto persegi yang kebetulan ditutupi CSS
bundar; tempat lain yang menampilkannya kelak tidak perlu tahu bahwa fotonya
harus dibulatkan sendiri. Tanpa pemotong, foto dari kamera HP (hampir selalu
potret 4000px) dipasang apa adanya lalu dipotong di bagian tengah — yang untuk
foto setengah badan berarti avatar berisi dada, bukan wajah.

Pemotongnya ditulis sendiri, tanpa menambah pustaka: satu bingkai, geser, dan
zoom seluruhnya bisa dikerjakan `<canvas>` dan pointer event, dan menambah
dependensi ke tech stack menuntut persetujuan tersendiri (CLAUDE.md §4).
Geserannya ditahan supaya gambar selalu menutupi bingkai — tanpa itu seseorang
bisa menyimpan avatar yang separuhnya kosong tanpa pernah melihat bahwa itu yang
ia simpan.

Kartunya hanya muncul kalau `staff.id === customer.id`. Satu peramban bisa
memegang dua sesi untuk akun berbeda (admin yang sedang menguji akun pelanggan);
tanpa perbandingan itu, halaman menampilkan nama pelanggan di kepalanya tapi
menyunting profil akun admin di bawahnya.

### Tombol WhatsApp di halaman penawaran publik

`buildPublicContactTarget()` memilih tujuan dari **ketersediaan**, bukan
preferensi:

| Keadaan | Tujuan | Isi pesan |
|---|---|---|
| Nomor sales terisi | sales | Menyapa sales-nya langsung, menyebut nama pelanggan & nomor dokumen |
| Nomor sales kosong | CS | Sama, **plus** kalimat bahwa penawaran ini dibuat Sales X yang nomornya belum terdaftar |

Kalimat terakhir itu bukan hiasan: tanpa dia, CS menerima pertanyaan tentang
penawaran yang tidak pernah ia buat, tanpa petunjuk harus dioper ke siapa — dan
tidak ada apa pun yang memberi tahu bahwa ada sales yang belum mengisi nomornya.

Nomor sales dinilai dengan ambang yang sama dengan nomor pelanggan
(`MIN_DIGIT_NOMOR`). Nomor yang cacat lebih baik jatuh ke CS daripada mendarat
di halaman wa.me yang berbunyi "nomor tidak valid" di depan pelanggan.

---

## 16. Sunting identitas pelanggan tanpa menaikkan revisi (23 September 2026)

Nama, nomor WhatsApp, dan catatan internal disunting dari dialog di halaman
detail quotation (`updateQuotationCustomer`). Syaratnya sama dengan revisi:
pemiliknya, dan hanya selama status `terbit`.

**Tidak menaikkan nomor revisi, dan itu intinya.** Identitas pelanggan memang
tidak ikut diversikan (lihat catatan model `PcBuildQuoteRevision`). Sebelum ini
satu-satunya cara membetulkan satu digit nomor HP adalah membuka Revisi di
Builder dan menyimpannya kembali — yang menghasilkan riwayat revisi berisi
versi-versi dengan isi rakitan dan harga yang sama persis. Riwayat seperti itu
berbohong tentang apa yang terjadi.

Nomornya **tidak** divalidasi ketat, pola yang sama dengan penerbitan: yang
mengetik adalah staff yang sedang menyalin dari layar HP pelanggan, dan validasi
ketat hanya menghasilkan nomor yang "dibetulkan" supaya lolos.

### Tombol follow-up tidak lagi hilang saat nomor kosong

Dulu `FollowUpWaButton` merender `null` kalau nomornya terlalu pendek. Tombol
yang tidak muncul tidak menjelaskan apa pun — sales mengira fiturnya rusak,
bukan mengira ada data yang belum diisi. Sekarang tombolnya selalu ada, dan
menekannya saat nomor kosong membuka dialog Data Pelanggan dengan kursor di
kolom nomor: jalan keluarnya ada di tempat masalahnya ditemukan.

Komponennya sekarang `QuotationCustomerActions` — satu pulau klien yang memegang
tombol follow-up dan dialognya sekaligus, karena keduanya berbagi satu keadaan.
`follow-up-wa-button.tsx` dihapus (nol importer).

### Ukuran tombol

Tinggi, padding, dan ukuran huruf tombol aksi datang dari
`features/quotation/lib/button-styles.ts`. Tombol-tombol itu lahir bertahap dan
masing-masing membawa ukurannya sendiri, sehingga satu baris berisi lima tombol
dengan lima tinggi berbeda. Di HP barisnya jadi grid dua kolom, bukan menara
tombol selebar layar.

Lencana status di `/verify` — Asli, Terjual/Belum terjual, Sudah DP — memakai
satu komponen bersama (`app/verify/quote-badge.tsx`) di GRID maupun di halaman
detail. Kasir membaca dua layar itu dalam satu pekerjaan; dua gaya berbeda untuk
keadaan yang sama memaksanya membaca ulang setiap kali. Penanda DP kini ikut
tampil di kartu daftar: yang sudah DP paling sering ditagih ulang penuh justru
karena tandanya baru terlihat setelah halaman detail terbuka.

---

## 17. Bilah tab di `/profile` (23 September 2026)

Tiga tab untuk staff berizin `quotation-terbit`, dan **`/profile` adalah salah
satunya**:

```
Profil Saya  |  Quotation Pelanggan  |  Rakitan Tersimpan
```

Percobaan pertama menaruh bilah ini di TENGAH `/profile`: kartu ringkas akun di
atasnya, kartu profil yang bisa disunting di bawahnya. Hasilnya dua kotak
berjudul "Profil Saya" bertumpuk dengan bilah tab terjepit di antaranya, dan
pengaturan akun terbaca seolah isi tab "Rakitan Tersimpan" yang sedang aktif —
membingungkan di desktop, lebih parah di HP tempat keduanya tidak muat dalam
satu layar.

Sekarang bilahnya selalu di paling atas dan tab yang aktif selalu menjelaskan
apa yang sedang dilihat. Ketiga halaman juga berbentuk sama: **satu `<h1>` di
atas bilah tab**, lalu isinya. Sebelumnya `/profile` menaruh judulnya di dalam
kartu sementara dua tab lain menaruhnya di luar, jadi berpindah tab terasa
seperti berpindah aplikasi. Judul `/profile/quotation` ikut disamakan dengan
label tabnya ("Quotation Pelanggan", dulu "Quotation Saya") — dua nama untuk satu
halaman membuat pembacanya berhenti sejenak tiap kali untuk memastikan ia tidak
salah pindah. Kartu kepala lama dilebur ke dalam kartu profil: foto,
nama akun, dan tombol "Panel Admin"/"Keluar" jadi kepala kartu yang sama dengan
formulirnya. Keduanya dititipkan sebagai `actions` dari halaman server — bukan
dipindah ke komponen klien, karena tombol Keluar adalah `<form>` beraksi server.

Daftar rakitan **tidak lagi ikut dirender di `/profile`** untuk staff: isinya
sama persis dengan tab "Rakitan Tersimpan", dan menampilkannya dua kali membuat
tab yang aktif berhenti berarti. Pelanggan biasa tidak melihat bilah tab sama
sekali — bagi mereka memang cuma ada satu daftar, dan satu tab bukan tab — jadi
bagi mereka halaman ini tidak berubah sedikit pun.

Formulir nama tampilan di `/profile/quotation` diganti satu baris penunjuk ke
`/profile`. Menaruh formulir yang sama di dua halaman berarti dua layar bisa
menampilkan nilai berbeda untuk kolom yang sama — yang satu masih memegang nilai
lama saat yang lain sudah disimpan.

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
