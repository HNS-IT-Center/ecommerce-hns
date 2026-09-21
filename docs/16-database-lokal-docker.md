# Database Lokal (Docker) untuk Pengujian

> Baca ini sebelum menguji perubahan yang menyentuh database, menjalankan skrip
> tulis, atau mencoba migrasi baru.

Sampai 21 September 2026 pengembangan lokal menembak langsung ke MariaDB
Hostinger — database yang sama yang dipakai pelanggan. Artinya setiap percobaan
skrip, setiap migrasi yang belum yakin, dan setiap `npm run dev` yang sedang
dioprek berbagi satu katalog dengan toko yang sedang berjalan. Database uji
`u859138789_restore_uji` memang ada, tapi ia tetap di server yang sama dan harus
dipilih dengan sadar.

Dokumen ini menjelaskan gantinya: **MariaDB di laptop, lewat Docker**.

---

## 1. Yang perlu disiapkan sekali

1. **Docker Desktop** terpasang dan menyala.
2. Nyalakan databasenya:

   ```bash
   npm run db:up
   ```

   Pertama kali, Docker mengunduh image `mariadb:11.8` (±150 MB). Tunggu sampai
   statusnya `healthy`:

   ```bash
   npm run db:status
   ```

3. **Tukar `DATABASE_URL` di `.env.local`** menjadi database lokal, dan simpan
   URL produksi dengan nama lain:

   ```dotenv
   DATABASE_URL="mysql://hns:hns@127.0.0.1:3307/ecommerce_hns"
   PROD_DATABASE_URL="mysql://<user>:<sandi>@<host-hostinger>:3306/<db>"
   ```

   Penamaan ini yang menjaga keselamatannya. Semua yang membaca `DATABASE_URL`
   — `npm run dev`, `prisma migrate deploy`, `prisma db seed`, `prisma studio`,
   dan **seluruh skrip di `scripts/`** — sekarang mendarat di laptop. Produksi
   hanya terjangkau oleh yang menyebut `PROD_DATABASE_URL` secara eksplisit,
   dan satu-satunya yang melakukannya adalah skrip penarik data di §2 (yang
   cuma membaca).

4. Isi datanya — lihat §2.

**Kalau perlu menjalankan skrip TULIS ke produksi** (mis. skrip harga dengan
`--tulis`): pindahkan nilai `PROD_DATABASE_URL` ke `DATABASE_URL` secara sadar,
jalankan, lalu kembalikan. Jangan biarkan tertukar semalaman — perubahan yang
Anda kira mendarat di laptop akan mendarat di toko.

---

## 2. Mengisi database lokal dengan data produksi (tanpa data pribadi)

```bash
npm run db:tarik-produksi
```

Skrip `scripts/tarik-data-produksi.mts` menjalankan `mariadb-dump` **dari dalam
container** ke Hostinger (baca-saja), menyimpan hasilnya di `docker/dumps/`
(di-gitignore), lalu mengimpornya ke database lokal. Hasil pada 21 September
2026: ±5.475 produk, ±14.600 baris gambar, 11 MB, sekitar satu menit.

**Enam tabel ikut strukturnya saja, tanpa satu baris pun:**

| Tabel | Alasan |
|---|---|
| `users` | Sejak Satu Login (5 Sep 2026) menampung pelanggan juga: nama, email, hash password |
| `customers` | Akun pelanggan lama |
| `customer_verification_tokens` | Menunjuk `users` lewat FK |
| `saved_pc_builds` | Menunjuk `users` lewat FK |
| `customer_deletion_logs` | Jejak permintaan penghapusan akun |
| `pc_build_submissions` | Nama dan nomor WhatsApp pengirim rakitan |

Ini bukan kehati-hatian berlebihan. Menyalin baris-baris itu ke laptop berarti
menggandakan data pribadi ke tempat yang tidak pernah dijanjikan kepada
pemiliknya, dan tanpa jalur penghapusan: pelanggan yang menghapus akunnya
(CLAUDE.md §2.8) tidak ikut terhapus dari salinan di sini. Untuk menguji
katalog, harga, kategori, dan quotation rakitan, data itu memang tidak
dibutuhkan.

Akun admin lokal dibuat sendiri:

```bash
npx tsx scripts/create-admin-user.mts admin@lokal.test "Admin Lokal" --username admin
```

Isi konten kebijakan/FAQ/banner kalau database lokal dimulai dari kosong:

```bash
npx prisma db seed
```

Varian lain:

```bash
npm run db:tarik-produksi -- --dump-saja                            # ambil dump, jangan impor
npm run db:tarik-produksi -- --impor docker/dumps/produksi-xxx.sql  # impor ulang dump lama
```

Skrip ini **menolak jalan** kalau `DATABASE_URL` bukan `127.0.0.1`/`localhost`.
Impor berarti DROP TABLE lalu isi ulang; salah sasaran sekali saja berarti
katalog produksi terhapus.

---

## 3. Perintah sehari-hari

| Perintah | Gunanya |
|---|---|
| `npm run db:up` | Nyalakan database lokal |
| `npm run db:down` | Matikan (data TETAP tersimpan di volume) |
| `npm run db:status` | Lihat status & kesehatan container |
| `npm run db:logs` | Ikuti log MariaDB |
| `npm run db:shell` | Masuk ke klien `mariadb` di dalam container |
| `npm run db:reset` | **Hapus volume** — database lokal kembali kosong |
| `npm run db:tarik-produksi` | Isi ulang dari produksi (tanpa data pribadi) |

Mau lihat isi tabel lewat antarmuka? Adminer ada di balik profil `alat`:

```bash
docker compose -f docker-compose.dev.yml --profile alat up -d adminer
# buka http://localhost:8080 — server: mariadb, user: hns, sandi: hns
```

---

## 4. Yang disamakan dengan produksi, dan kenapa

`docker-compose.dev.yml` mematok tiga hal supaya bukan cuma "ada databasenya",
melainkan berperilaku seperti produksi:

- **Versi `mariadb:11.8`** — produksi Hostinger 11.8.9 (diperiksa 21 September
  2026). Kalau produksi naik versi, naikkan juga di compose.
- **`utf8mb4` / `utf8mb4_unicode_ci`** — seluruh kolom skema ini memakainya.
  Collation server yang berbeda menghasilkan tabel berbeda saat
  `migrate deploy`, dan pencarian produk bisa jatuh dengan "Illegal mix of
  collations" — bug yang dicatat di `src/lib/prisma/client.ts`.
- **`sql_mode` yang sama** (`IGNORE_SPACE,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION`)
  — aturan ketat/longgar yang berlaku di sana berlaku juga di sini.

Yang **sengaja berbeda**: user `hns` di lokal punya izin penuh termasuk
`CREATE DATABASE`, sedangkan user Hostinger tidak. Itu membuat *shadow database*
bisa dibuat di laptop — berguna untuk menyusun berkas migrasi (§5).

Port host **3307**, bukan 3306, supaya tidak bentrok dengan MySQL/XAMPP yang
mungkin sudah terpasang. Port-nya diikat ke `127.0.0.1` saja: tanpa itu Docker
membuka database ini ke seluruh jaringan WiFi dengan password `hns`.

---

## 5. Migrasi di database lokal

Aturan di [`docs/08-database-migrations.md`](./08-database-migrations.md) **tidak
berubah**: `prisma migrate dev` dan `prisma db push` tetap dilarang di project
ini, termasuk di lokal. Yang dijaga aturan itu bukan sekadar hak akses, melainkan
satu riwayat migrasi yang sama untuk semua orang — `db push` menghasilkan skema
yang tidak tercatat di mana pun, dan itu tetap benar walau databasenya cuma di
laptop.

Yang jadi lebih baik dengan adanya database lokal:

- **Menerapkan migrasi**: `npx prisma migrate deploy` ke lokal dulu. Kalau
  SQL-nya salah, yang rusak katalog salinan, bukan katalog toko.
- **Menyusun migrasi**: `prisma migrate diff` bisa membaca database lokal
  (`--from-config-datasource`) tanpa menanyai produksi.
- **Uji pemulihan**: `npm run db:reset` lalu `migrate deploy` dari nol
  membuktikan rangkaian 21 migrasi itu benar-benar bisa membangun skema dari
  database kosong — sesuatu yang tidak pernah bisa dicoba di produksi.

Dump produksi membawa serta tabel `_prisma_migrations`, jadi setelah
`npm run db:tarik-produksi` riwayat migrasi lokal identik dengan produksi
(`npx prisma migrate status` → "Database schema is up to date!").

---

## 6. Gambar produk: bucket R2 terpisah

Database sudah terpisah; penyimpanan gambar jangan ikut menumpang bucket
produksi, karena unggahan percobaan tidak punya tombol "batal" dan URL-nya
tersimpan di tabel `product_images`.

Sudah disiapkan (21 September 2026):

| | Produksi | Uji lokal |
|---|---|---|
| Bucket R2 | `ecommerce-hns` | `ecommerce-hns-dev` |
| Domain publik | `media.hnsitcenter.com` | `media-dev.hnsitcenter.com` |

Yang perlu ditukar di `.env.local` hanya dua baris — `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, dan `R2_SECRET_ACCESS_KEY` tetap, karena tokennya berlaku
untuk akun yang sama:

```dotenv
R2_BUCKET_NAME=ecommerce-hns-dev
NEXT_PUBLIC_R2_PUBLIC_URL=https://media-dev.hnsitcenter.com
```

Host `media-dev.hnsitcenter.com` sudah terdaftar di `remotePatterns`
(`next.config.ts`) — tanpa itu `next/image` menolak gambarnya dengan 400.
Entri itu ikut build produksi dan tidak apa-apa: ia hanya MENGIZINKAN host
tersebut ditampilkan, bukan membuat URL mengarah ke sana.

Jalur `admin/produk/image-uploader.tsx` → `POST /api/admin/media` →
`uploadMedia()` sudah diuji ujung ke ujung ke bucket uji: berkas terunggah,
domain publik membalas 200 dengan `content-type` yang benar, objek ujinya lalu
dihapus.

**Catatan yang muncul dari pengujian itu:** `uploadMedia()` menyetel
`Cache-Control: public, max-age=31536000`, jadi objek yang sudah DIHAPUS dari
bucket masih dilayani Cloudflare dari cache tepi (terbukti: `cf-cache-status:
HIT` sesudah penghapusan). Dalam pemakaian normal ini tidak menimbulkan gambar
basi, karena setiap unggahan mendapat kunci baru yang unik — tapi jangan
mengandalkan penghapusan objek untuk "menarik kembali" gambar yang terlanjur
tersebar. Yang menarik gambar dari halaman adalah menghapus barisnya di
`product_images`, bukan menghapus objeknya di R2.

Tidak ada MinIO di compose ini, dan itu disengaja: `lib/api/cloudflare/r2.ts`
menyusun endpoint dari `R2_ACCOUNT_ID`, sehingga memakai S3 lokal menuntut
perubahan kode pada jalur unggah — jalur yang justru ingin diuji apa adanya.

---

## 7. Menyiapkan di laptop lain (rekan tim)

Setiap orang menjalankan containernya sendiri. Tidak ada port database yang
dibuka ke jaringan, jadi tidak perlu satu laptop menyala demi laptop lain, dan
`npm run db:reset` milik seseorang tidak pernah menghapus kerja orang lain.

1. **Pasang Docker Desktop** (Windows: butuh WSL2), nyalakan.
2. `git pull` di branch `development` — `docker-compose.dev.yml`, skrip penarik
   data, dan dokumen ini ikut git.
3. `npm install`
4. Buat `.env.local`. Salin dari `.env.example`, lalu minta nilai rahasianya
   (kunci R2, `AUTH_SECRET`, SMTP, `PROD_DATABASE_URL`) lewat jalur internal —
   **jangan lewat repo, chat grup, atau email**. Bagian databasenya:

   ```dotenv
   DATABASE_URL="mysql://hns:hns@127.0.0.1:3307/ecommerce_hns"
   ```

5. `npm run db:up`, tunggu `healthy` (`npm run db:status`).
6. Isi datanya — dua jalan:

   **a. Menarik sendiri dari produksi** (`npm run db:tarik-produksi`). Butuh
   `PROD_DATABASE_URL` DAN IP laptop itu diizinkan di hPanel Hostinger →
   **Databases → Remote MySQL**. IP rumah biasanya dinamis, jadi cara ini
   menuntut daftar izin diperbarui sewaktu-waktu.

   **b. Impor dari berkas dump** — tidak butuh akses produksi sama sekali:

   ```bash
   npm run db:tarik-produksi -- --impor docker/dumps/produksi-xxxx.sql
   ```

   Berkas dumpnya dikirim lewat jalur internal (±11 MB). Ia sudah bersih dari
   data pribadi (§2), tapi tetap memuat harga modal, stok, dan catatan
   pembelian — perlakukan seperti dokumen internal, jangan diunggah ke tempat
   umum.

7. Akun admin lokal, dibuat masing-masing:

   ```bash
   npx tsx scripts/create-admin-user.mts admin@lokal.test "Admin Lokal" --username admin
   ```

8. `npm run dev` — setelah database `healthy`, bukan sebelumnya.

Database tiap orang berjalan sendiri-sendiri dan tidak pernah sinkron otomatis.
Kalau perlu bekerja di atas data yang sama persis (mis. menelusuri satu bug),
tarik ulang dari sumber yang sama: dump yang sama, atau
`npm run db:tarik-produksi` di hari yang sama.

Untuk unggah gambar, bucket ujinya boleh dipakai bersama
(`ecommerce-hns-dev`) — objeknya tidak pernah saling menimpa karena setiap
unggahan mendapat kunci unik.

---

## 8. Kalau ada masalah

| Gejala | Sebabnya |
|---|---|
| `Container database lokal belum siap` | `npm run db:up` belum dijalankan, atau masih `starting` — cek `npm run db:status` |
| `ECONNREFUSED 127.0.0.1:3307` | Container mati. `npm run db:up` |
| `port is already allocated` | Ada yang memakai 3307. Ubah sisi host di `docker-compose.dev.yml` |
| `PENJAGA KESELAMATAN: DATABASE_URL menunjuk ke …` | `DATABASE_URL` masih produksi — tukar sesuai §1 |
| Data terasa basi | `npm run db:tarik-produksi` menariknya ulang |
| Ingin benar-benar dari nol | `npm run db:reset`, lalu `npm run db:up` + `npx prisma migrate deploy` + `npx prisma db seed` |

Peringatan `WARNING: option --ssl-verify-server-cert is disabled` saat menarik
data itu bawaan klien MariaDB dan bukan tanda kegagalan — dumpnya tetap jalan.
