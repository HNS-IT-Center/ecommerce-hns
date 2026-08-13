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

## 3. Sebelum commit

```bash
npm run typecheck   # tsc --noEmit
npm run lint
```

Keduanya wajib lolos — lihat checklist di `CLAUDE.md` §5. Vercel **akan gagal build**
kalau ada error TypeScript atau ESLint yang tidak tertangani, jadi jalankan lokal
dulu, jangan menunggu pipeline yang memberitahu.

---

## 4. Cutover domain produksi

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

## 5. Setelah deploy

- Buka `/admin/login` dan pastikan bisa masuk.
- Buka satu halaman produk dan pastikan harga serta gambar tampil.
- Cek `robots.txt` seperti di atas.
