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

1. **Ubah `NEXT_PUBLIC_SITE_URL` lebih dulu**, sebelum domainnya diarahkan.

   `src/app/robots.ts` membaca variabel ini: selama nilainya belum mengandung
   `hnsitcenter.id`, ia menyatakan `disallow: "/"` untuk semua crawler. Ini
   disengaja supaya deployment staging (`*.vercel.app`) tidak terindeks Google
   sebagai duplikat situs utama.

   Kalau env-nya telat diperbarui, domain produksi ikut ter-`disallow` — situsnya
   hidup tapi tidak pernah muncul di pencarian.

2. Verifikasi setelah cutover:

   ```bash
   curl https://hnsitcenter.id/robots.txt
   ```

   Pastikan isinya `Allow: /`, bukan `Disallow: /`.

3. Pastikan seluruh variabel environment produksi sudah terisi di Vercel — daftar
   lengkap beserta artinya ada di
   [`docs/07-environment-variables.md`](./07-environment-variables.md).

---

## 5. Setelah deploy

- Buka `/admin/login` dan pastikan bisa masuk.
- Buka satu halaman produk dan pastikan harga serta gambar tampil.
- Cek `robots.txt` seperti di atas.
