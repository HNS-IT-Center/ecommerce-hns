# Prosedur Deployment

> Baca ini sebelum menyiapkan environment baru atau melakukan cutover domain.
>
> Dokumen ini memuat **perintah dan urutannya** saja. Daftar item yang harus
> diselesaikan sebelum go-live (status fitur, temuan yang belum ditutup) ada di
> `PRE-DEPLOY-CHECKLIST.md` — berkas lokal yang sengaja tidak ikut git.

---

## Kenapa dokumen ini ikut git

Prosedur ini sempat hanya hidup di `PRE-DEPLOY-CHECKLIST.md`, yang di-gitignore.
Akibatnya salinan yang berbeda bisa hidup di beberapa laptop tanpa pernah bertemu —
dan salinan di satu laptop masih menyuruh menjalankan `prisma migrate dev --name init`
berbulan-bulan setelah perintah itu dilarang.

Ini pola yang sama persis dengan insiden dua salinan `CLAUDE.md` (lihat pembuka
`CLAUDE.md`). **Perintah yang dijalankan orang terhadap database produksi adalah
aturan, dan aturan tidak boleh hanya ada di satu laptop.**

---

## 1. Menyiapkan database di environment baru

Berlaku untuk staging, laptop developer baru, atau database yang baru dibuat di
hPanel Hostinger.

```bash
# 1. Isi DATABASE_URL di .env.local
#    mysql://user:password@host:3306/dbname

# 2. Terapkan seluruh migrasi
npx prisma migrate deploy

# 3. Hasilkan Prisma Client
npx prisma generate

# 4. Isi konten awal (4 halaman kebijakan, 8 FAQ, 2 toko, banner)
npx prisma db seed
```

> **JANGAN `prisma migrate dev` maupun `prisma db push`.** Dua-duanya dilarang di
> repo ini — alasan lengkapnya di [`docs/08-database-migrations.md`](./08-database-migrations.md).
> Singkatnya: `migrate dev` butuh shadow database (user MariaDB Hostinger tidak punya
> izin `CREATE DATABASE`) dan menawarkan me-reset database kalau riwayat migrasi
> dianggap tidak cocok — menyetujuinya menghapus katalog produk beserta akun admin.
> `db push` sudah tidak dipakai sejak 5 Agustus 2026, dan ia yang menyebabkan
> insiden `Unknown column`.

`db seed` aman diulang untuk baris yang sudah ada (memakai `upsert`), tapi periksa
`prisma/seed.ts` sebelum menjalankannya di database berisi data sungguhan.

---

## 2. Mengubah skema database

Ikuti [`docs/08-database-migrations.md`](./08-database-migrations.md) sepenuhnya —
lima langkah, termasuk **membaca SQL hasil generate sebelum menerapkannya** dan
**me-restart dev server sesudahnya**.

Ringkasnya:

```bash
mkdir -p "prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<nama>"

npx prisma migrate diff \
  --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema.prisma \
  --script > "prisma/migrations/<folder-tadi>/migration.sql"

# BACA migration.sql lebih dulu, lalu:
npx prisma migrate deploy
npx prisma generate
```

Memeriksa keadaan tanpa mengubah apa pun:

```bash
npx prisma migrate status
```

---

### Migrasi ikut berjalan saat build (31 Agustus 2026)

`npm run build` sekarang berbunyi **`prisma migrate deploy && next build`**.

Alasannya sebuah kegagalan deploy yang nyata: migrasi `add_banner_batches` dibuat
dan di-commit pada 29 Agustus, tapi tidak pernah diterapkan ke database. Karena
Prisma Client menyertakan seluruh kolom skalar di setiap query, **semua**
pembacaan `promo_banners` gagal dengan `P2022 — The column
promo_banners.batch_id does not exist`, bukan hanya yang menyentuh kolom baru
itu. Beranda ikut mati, dan build deploy berhenti di langkah prerender `/`.

Yang menerapkan migrasi dulu cuma ingatan orang. Sekarang tidak lagi.

**Yang perlu diingat tentang perubahan ini:**

- Setiap deploy menjalankan migrasi ke database yang ditunjuk `DATABASE_URL`
  **environment itu** — termasuk deployment preview kalau URL-nya sama dengan
  produksi. Periksa `DATABASE_URL` tiap environment sebelum mengandalkan ini.
- Migrasi berjalan **sebelum** kode baru hidup. Aman untuk migrasi yang menambah
  (kolom nullable, tabel baru). Untuk migrasi yang membuang kolom, versi lama
  yang masih melayani permintaan akan patah selama jeda itu — pecah jadi dua
  deploy: tambah dulu, buang setelah kode lama tidak dipakai lagi.
- `migrate deploy` tidak pernah menawarkan reset dan hanya menerapkan yang belum
  tercatat, jadi menjalankannya berulang kali tidak berbahaya.
- Butuh build tanpa menyentuh database (mis. memeriksa kompilasi di laptop):
  **`npm run build:app`** — `next build` saja.

Ini TIDAK menggantikan `docs/08`: migrasi tetap dibuat dan SQL-nya tetap dibaca
manusia sebelum di-commit. Yang otomatis hanya penerapannya.

---

## 3. Sebelum commit

```bash
npm run typecheck   # tsc --noEmit
npm run lint
```

Keduanya wajib lolos — lihat checklist di `CLAUDE.md` §5. Vercel **akan gagal build**
kalau ada error TypeScript atau ESLint yang tidak tertangani, jadi jalankan lokal
dulu, jangan menunggu pipeline yang memberitahu.

---

## 4. Backup database

> Jalankan **sebelum** cutover, sebelum `migrate deploy` apa pun, dan sebelum
> skrip yang menulis massal. Backup yang tidak pernah diverifikasi bukan backup —
> ia cuma berkas yang menenangkan.

### Mengambil dump

`mysqldump` tidak ada di PATH mesin pengembangan; binernya numpang dari Laragon:
`C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\`.

Kredensial dioper lewat berkas sementara, **bukan** argumen baris perintah —
argumen terbaca proses lain di mesin yang sama dan tersimpan di riwayat shell.

```bash
# 1. Berkas kredensial sementara
cat > /tmp/dump.cnf <<'EOF'
[client]
host=<host>
port=3306
user=<user>
password="<password>"
EOF

# 2. Dump
mysqldump --defaults-extra-file=/tmp/dump.cnf \
  --single-transaction --quick --routines --triggers \
  --no-tablespaces --column-statistics=0 --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  u859138789_ecommerce_hns > "u859138789_ecommerce_hns_$(date +%Y-%m-%d_%H%M).sql"

# 3. Hapus kredensialnya — jangan ditunda
rm -f /tmp/dump.cnf
```

Empat flag yang tidak boleh dihilangkan:

| Flag | Kenapa |
|---|---|
| `--single-transaction` | Snapshot konsisten tanpa mengunci tabel — database ini melayani staging sementara dump berjalan |
| `--column-statistics=0` | Klien MySQL 8 menanyakan `information_schema.COLUMN_STATISTICS`, yang tidak ada di MariaDB |
| `--no-tablespaces` | User shared hosting Hostinger tidak punya privilege `PROCESS` |
| `--set-gtid-purged=OFF` | Mencegah pernyataan GTID khas MySQL ikut masuk ke dump MariaDB |

**Simpan di luar folder repo.** Dump memuat email dan nama pelanggan, hash
password, serta akun admin. Jangan sampai ikut ter-commit, dan jangan diunggah
ke Drive/WhatsApp/chat tanpa dipikirkan lebih dulu.

### Verifikasi dump — jangan dilewati

```bash
grep -c "^CREATE TABLE" <berkas>.sql   # jumlah tabel
tail -2 <berkas>.sql                   # harus "-- Dump completed on ..."
```

Dump yang terpotong di tengah tetap terlihat seperti berkas `.sql` yang wajar dan
tetap berukuran besar. Baris `Dump completed` satu-satunya penanda bahwa
`mysqldump` benar-benar selesai, bukan mati di tengah jalan.

Hitung baris per tabel langsung dari berkasnya:

```bash
for t in products product_images brands customers; do
  n=$(grep "^INSERT INTO \`$t\`" <berkas>.sql | grep -o "),(" | wc -l)
  s=$(grep -c "^INSERT INTO \`$t\`" <berkas>.sql)
  echo "$t $((n + s))"
done
```

(`n` menghitung pemisah antar-tuple; `s` menambahkan tuple pertama tiap
pernyataan `INSERT`.)

**Angka pembanding per 19 Agustus 2026** — kalau suatu saat hasilnya jauh
berbeda tanpa penjelasan, curigai dumpnya lebih dulu:

| | |
|---|---|
| `products` | 5.196 |
| `product_images` | 12.835 |
| `brands` | 135 |
| `customers` | 5 |
| Tabel | 26 |
| Ukuran | 6,5 MB |

### Restore — WAJIB ke database bernama LAIN

> **Dump ini memuat `DROP TABLE IF EXISTS` untuk ke-26 tabelnya.** Memuatkannya
> ke database yang sedang dipakai akan **menghapus tabel yang ada beserta
> seluruh isinya** lebih dulu, lalu menggantinya dengan isi backup. Tidak ada
> konfirmasi, tidak ada undo. Semua data yang masuk setelah backup diambil
> hilang tanpa jejak.

Karena itu: **restore selalu ke database bernama lain, periksa dulu, baru
putuskan.**

Dump ini sengaja tidak memuat `CREATE DATABASE` maupun `USE` (satu database,
tanpa `--databases`), jadi ia bisa dimuat ke nama database apa pun.

1. **Buat database kosong lewat hPanel Hostinger** — misalnya
   `u859138789_restore_uji`. Harus lewat hPanel: user MariaDB project ini tidak
   punya privilege `CREATE DATABASE`. Itu keterbatasan yang sama yang membuat
   `prisma migrate dev` tidak bisa dipakai di sini — lihat
   [`docs/08-database-migrations.md`](./08-database-migrations.md).

2. **Muat dumpnya ke sana:**

   ```bash
   mysql --defaults-extra-file=/tmp/dump.cnf u859138789_restore_uji < <berkas>.sql
   ```

3. **Verifikasi jumlah barisnya sebelum mempercayainya:**

   ```bash
   mysql --defaults-extra-file=/tmp/dump.cnf u859138789_restore_uji \
     -e "SELECT 'products' t, COUNT(*) n FROM products
         UNION ALL SELECT 'product_images', COUNT(*) FROM product_images
         UNION ALL SELECT 'brands', COUNT(*) FROM brands
         UNION ALL SELECT 'customers', COUNT(*) FROM customers;"
   ```

   Angkanya harus sama dengan hasil hitungan dari berkas dump di atas. Kalau
   berbeda, dumpnya cacat — jangan dijadikan dasar pemulihan apa pun.

4. Baru setelah angkanya cocok, database itu sah dipakai: sebagai sumber
   menyalin baris yang hilang, atau sebagai kandidat pengganti.

**Jangan pernah** menjalankan langkah 2 dengan nama database produksi sebagai
jalan pintas "biar cepat". Kalau memang niatnya memulihkan produksi seutuhnya,
ambil dump **baru** dari produksi lebih dulu — supaya keadaan sebelum pemulihan
masih ada kalau ternyata keputusannya keliru.

---

## 5. Cutover domain produksi

Saat mengarahkan `hnsitcenter.id` ke deployment ini:

1. **Pastikan domainnya ada di daftar `INDEXABLE_HOSTS`** (`src/app/robots.ts`).

   Sejak 13 Agustus 2026 `robots.ts` memutuskan berdasarkan **host request**,
   bukan `NEXT_PUBLIC_SITE_URL`. Hanya host di daftar itu (`hnsitcenter.id` dan
   `www.hnsitcenter.id`) yang mendapat `Allow: /`; host lain — termasuk staging
   `store.hnsitcenter.id` dan host tak dikenal — mendapat `Disallow: /`.

   Dasarnya sengaja host request, karena env bisa salah tanpa ada yang
   menyadarinya: pada 13 Agustus 2026 `NEXT_PUBLIC_SITE_URL` di produksi
   ternyata masih `http://localhost:3000`. Penjaga yang bergantung pada nilai
   yang sama-sama bisa salah tidak menjaga apa pun.

   **Gagal tertutup:** domain baru yang belum ditambahkan ke daftar TIDAK akan
   terindeks. Jadi kalau domainnya berubah, tambahkan di `INDEXABLE_HOSTS`
   lebih dulu — jangan menunggu sampai sadar situsnya tidak muncul di Google.

2. **`NEXT_PUBLIC_SITE_URL` tetap harus benar.** Ia tidak lagi menentukan
   robots/sitemap (keduanya memakai host request lewat `resolveSiteUrl()`),
   tapi masih dipakai `metadataBase`, JSON-LD, dan canonical di
   `src/app/layout.tsx`.

3. Verifikasi setelah cutover:

   ```bash
   curl https://hnsitcenter.id/robots.txt   # harus Allow: /
   curl https://hnsitcenter.id/sitemap.xml | head   # <loc> harus domain asli
   ```

   Kalau `<loc>` masih `localhost`, berarti ada yang salah di resolusi host —
   jangan biarkan, itu menyajikan alamat yang tidak bisa dijangkau siapa pun
   atas nama domain HNS.

4. Pastikan seluruh variabel environment produksi sudah terisi — daftar lengkap
   beserta artinya ada di
   [`docs/07-environment-variables.md`](./07-environment-variables.md).

---

## 6. Setelah deploy

- Buka `/admin/login` dan pastikan bisa masuk.
- Buka satu halaman produk dan pastikan harga serta gambar tampil.
- Cek `robots.txt` seperti di atas.
