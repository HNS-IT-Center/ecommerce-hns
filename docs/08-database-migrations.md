# Migrasi Database

> Baca ini sebelum mengubah `prisma/schema.prisma`.

Sejak **5 Agustus 2026**, perubahan skema di project ini dilacak lewat berkas migrasi
di `prisma/migrations/`. Sebelum itu semuanya diterapkan langsung dengan `db push`,
dan cara lama itu **sudah tidak dipakai lagi**.

---

## Aturan pertama: jangan jalankan `prisma migrate dev`

Perintah itu butuh **shadow database** — database kosong kedua yang dipakai Prisma
untuk menghitung ulang keadaan skema. User MariaDB di Hostinger tidak punya izin
`CREATE DATABASE`, jadi perintahnya akan gagal.

Yang lebih berbahaya: kalau riwayat migrasi dianggap tidak cocok, `migrate dev`
**menawarkan me-reset database**. Menyetujuinya berarti menghapus katalog produk
(±4.900 produk, ±13.000 gambar) beserta akun admin.

Kalau suatu saat `migrate dev` benar-benar dibutuhkan, buat dulu satu database kosong
di hPanel Hostinger lalu isi `shadowDatabaseUrl` di `prisma.config.ts`.

---

## Alur yang dipakai

### 1. Ubah `prisma/schema.prisma`

Seperti biasa.

### 2. Buat berkas migrasinya

```bash
# ganti <nama> dengan keterangan singkat, mis. add_store_photos
mkdir -p "prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<nama>"

npx prisma migrate diff \
  --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema.prisma \
  --script > "prisma/migrations/<folder-tadi>/migration.sql"
```

`--from-config-datasource` membaca keadaan database **yang sebenarnya**, bukan riwayat
migrasi. Artinya hasilnya juga memuat perubahan skema orang lain yang belum pernah
diterapkan — periksa isinya, jangan langsung percaya.

### 3. BACA SQL-nya sebelum diterapkan

Ini bukan formalitas. Dua hal yang sudah pernah terjadi:

- **Perintah yang mengasumsikan tabel kosong.** `ADD COLUMN ... NOT NULL` tanpa default
  akan gagal di tabel berisi data. Kalau kolomnya wajib, pecah jadi: tambah dengan
  default sementara → `UPDATE` untuk mengisi → buang default → baru pasang indeks unik.
  Lihat `20260805085409_add_store_slug_and_quote_print_tracking` sebagai contoh.
- **Perubahan yang bukan milikmu ikut terbawa**, karena `migrate diff` membandingkan
  dengan database, bukan dengan pekerjaanmu sendiri. Kalau ada `DROP COLUMN` yang tidak
  kamu rencanakan, hentikan dan tanyakan dulu ke yang membuatnya.

Tulis komentar di dalam `migration.sql` untuk keputusan yang tidak jelas dari SQL-nya.

### 4. Terapkan

```bash
npx prisma migrate deploy
npx prisma generate
```

`deploy` hanya menerapkan migrasi yang belum tercatat dan tidak pernah menawarkan reset.

### 5. Restart dev server

**Wajib, dan mudah terlupakan.** Prisma Client dimuat sekali saat proses start dan
di-cache di `globalThis`. Tanpa restart, aplikasi masih memakai client lama dan
memberi galat yang menyesatkan — mis. `Unknown column 'stores.slug'` atau
`Cannot read properties of undefined (reading 'findMany')`.

---

## Memeriksa keadaan

```bash
npx prisma migrate status
```

Menampilkan migrasi mana yang sudah dan belum diterapkan, tanpa mengubah apa pun.

---

## Catatan sejarah: kenapa ada `0_init`

Database ini sudah berisi 20 tabel sebelum migrasi diperkenalkan, jadi tidak mungkin
menjalankan migrasi dari nol. Prosedur *baselining* Prisma dipakai:

1. `0_init/migration.sql` dibuat dari keadaan database saat itu
   (`migrate diff --from-empty --to-config-datasource`)
2. Ditandai sudah diterapkan tanpa benar-benar dijalankan
   (`migrate resolve --applied 0_init`)

**`0_init` tidak boleh dijalankan ulang di database yang sudah ada.** Ia hanya berguna
untuk membangun database baru dari kosong — misalnya lingkungan staging.
