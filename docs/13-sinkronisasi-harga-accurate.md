# 13. Harga Accurate ↔ Web

> **Status: arah data DIBALIK, 19 September 2026.** Dokumen ini ditulis ulang
> dari nol, bukan ditambal — versi sebelumnya berjudul "Sinkronisasi Harga
> Accurate → Web" dan seluruh isinya berdiri di atas premis yang sekarang salah.
> Baca ini sebelum menyentuh harga, penautan, atau `/admin/harga-accurate`.

---

## 1. Keputusan yang membalik segalanya

**Harga jual ditetapkan di panel web. Accurate adalah salinannya.**

Keputusan pemilik project, 19 September 2026: Google Sheet gudang **sengaja**
tidak diberi kolom harga, *"karena pengaturan harganya di web, bukan di sheet"*.

Itu bukan kendala teknis yang menunggu diperbaiki. Itu pembagian wewenang —
gudang mengirim **data barang** (nama, kategori, brand, status, stok), web
menetapkan **harga**.

### Apa yang gugur karena keputusan ini

| Yang dulu benar | Keadaan sekarang |
|---|---|
| "Accurate sumber harga, web menyusul" | **Terbalik.** Web sumbernya |
| Tab Sinkronisasi menerapkan SP ke katalog | **Dimatikan** — §3 |
| Parser harga dari Sheet | **Dihapus** — Sheet tidak akan punya kolom harga |
| Rencana "perbaikan hulu" | **Tidak ada lagi hulu** untuk diperbaiki |
| "Dahulukan yang berharga, langsung berbuah saat disinkronkan" | Gugur — §5 |

---

## 2. Keadaan `accurate_products.SP`

**Beku sejak 28 Agustus 2026.** Tidak ada satu pun kode yang menulisnya:

- Google Sheet sumber tidak punya kolom harga — headernya `NO`, `KODE ACCURATE`,
  `NAMA BARANG`, `UPC/BARCODE`, `NAMA KATEGORI`, `NAMA BRAND`, `STATUS`, `STOK`.
- `import-sheet.ts` menulis tujuh kolom, **tidak satu pun harga** — memang
  disengaja, dan sekarang justru sejalan dengan §1.
- Tab Daftar Harga hanya menyunting Modal (`CP`) dan Dealer (`PRICE`).

Menekan "Import dari Google Sheet" berapa kali pun tidak menyegarkan harga.

**`SP` masih berguna, tapi sebagai penanda, bukan sebagai angka.** Barang yang
pernah punya harga adalah barang yang benar-benar dijual — bukan jasa, bukan
entri mati. Memakai **ada/tidaknya** untuk memilih urutan pekerjaan itu sah;
memakai **nilainya** tidak.

---

## 3. Penerapan SP ke katalog: DIMATIKAN

Sejak 19 September 2026, tab Sinkronisasi diganti pemberitahuan dan
`terapkanHargaAction` menolak semua permintaan.

### Kenapa dimatikan, dengan angkanya

Diukur 18 September 2026 terhadap 527 baris tertaut yang punya `SP` terbaca —
seandainya "Terapkan semua" ditekan hari itu:

| | Jumlah | Jumlah selisih |
|---|---|---|
| Harga web **turun** | **298** | Rp 378.842.000 |
| Harga web naik | 71 | Rp 19.723.000 |
| Tidak berubah | 158 | — |

Angka Rp 378 juta itu jumlah selisih per unit di 298 produk, bukan proyeksi
kerugian. Tapi arahnya jelas: satu klik mengembalikan harga ratusan produk
terbit ke angka tiga pekan lalu, dan tercatat rapi sebagai `SYNC_PRICE` sehingga
tampak sah.

Contoh nyata, semuanya produk yang dilihat pelanggan:

```
VGA MSI GTX 1650 VENTUS XS OCV3    3.000.000 -> 2.700.000
PRINTER CANON MG2570S AIO            850.000 ->   700.000
HEADSET FANTECH ALTO 7.1 HG26        680.000 ->   510.000
PROCESSOR RYZEN 7-5700G            4.150.000 -> 3.885.000
```

### Apakah tombol itu pernah ditekan?

**Tidak ada jejak yang berciri demikian.** Diperiksa ke `product_logs`,
19 September 2026. `SYNC_PRICE` memang ada 1.069 entri, tapi seluruhnya berasal
dari **sinkronisasi WooCommerce**, bukan Accurate — lihat §6.

Bukti bahwa 1.069 itu bukan penerapan Accurate:

1. Kalau tombol Accurate ditekan, `new_value` **pasti persis `SP`** — begitu cara
   kerjanya. Yang cocok cuma 1, 1, dan 2 entri dari ledakan 489/242/338.
2. Mayoritas produknya **belum tertaut** ke Accurate; tombol itu hanya bisa
   menyentuh yang tertaut.
3. Arahnya naik (888 naik vs 103 turun) — penerapan Accurate justru menurunkan.
4. `SYNC_IMPORT`, yang hanya ditulis importer WooCommerce, muncul di ledakan
   waktu yang sama.

Jadi mematikannya **mencegah**, bukan menghentikan.

Satu kehati-hatian: karena dua fitur berbagi nama aksi yang sama, yang bisa
dinyatakan adalah "tidak ada entri berciri penerapan Accurate" — bukan
"mustahil pernah ditekan".

### Cara menghidupkannya kembali

Kodenya sengaja utuh — `view.tsx`, `buildAccuratePricePreview`, dan
`terapkanHargaAction` tidak pernah dihapus. Dua tempat, dan harus dua-duanya:

1. `harga-accurate/page.tsx` — kembalikan deretan tab beserta pembacaan
   `?tab=`, kembalikan import `buildAccuratePricePreview` dan
   `HargaAccurateView`, lalu render `<HargaAccurateView initial={preview} />`
   pada tab kedua.
2. `harga-accurate/actions.ts` — `PENERAPAN_SP_AKTIF = true`.

Sengaja dua tempat supaya tidak ada jalur yang menyala tanpa disadari.

> **Perubahan 20 September 2026:** tab "Sinkronisasi" beserta kotak
> pemberitahuannya **dihapus dari panel** — isinya sudah tidak bisa dikerjakan
> apa pun, dan tab yang diklik lalu tidak menghasilkan apa-apa hanya mengundang
> pertanyaan. Yang tersisa di layar cuma satu baris di bawah judul halaman
> Update Harga: *"Penerapan harga otomatis dari Accurate dimatikan 19 September
> 2026."* Bentuk lama tab itu bisa dilihat di riwayat git. Mesinnya sendiri
> tidak tersentuh, termasuk penjaga `PENERAPAN_SP_AKTIF` di sisi server.
> Alamat lama `?tab=sinkronisasi` tidak patah: parameternya diabaikan.
>
> **Yang ikut terbawa mati tanpa disengaja, dan sudah dipulihkan:** tombol
> **Import dari Google Sheet** dulu hidup di dalam `view.tsx` — satu komponen
> dengan mesin penerapan harga. Begitu `view.tsx` berhenti dirender pada
> 19 September, tombol impor ikut lenyap dari layar, padahal impor data barang
> tidak punya hubungan apa pun dengan penerapan harga. Sejak 20 September ia
> berdiri sendiri di `import-sheet-button.tsx` sebagai tombol di kepala
> halaman, di balik izin `edit`. Pemisahan itu sekaligus mencegah kejadian
> yang sama terulang.

**Tapi sebelum itu**, yang harus benar lebih dulu adalah arahnya: harus ada
jalur yang membuat `SP` Accurate menyusul harga web, bukan sebaliknya.

---

## 4. Yang dipakai sebagai gantinya

| Kebutuhan | Tempatnya |
|---|---|
| Menetapkan harga jual | `/admin/produk`, dan kolom Harga Jual di `/admin/harga-accurate` (belum dibangun — §7) |
| Menetapkan modal & dealer | `/admin/harga-accurate` tab Daftar Harga |
| Menautkan barang Accurate ke produk web | `/admin/harga-accurate` tab Daftar Harga, dialog penautan |
| Memperbarui data barang dari gudang | Tombol **Import dari Google Sheet** di kepala `/admin/harga-accurate` (butuh izin `edit`) |

### Penjaga harga yang berlaku di semua jalur

Keduanya hidup di `lib/api/woocommerce/products.ts`, dipasang di
`updateProductPriceAction` — satu-satunya jalur tulis harga katalog:

- **`tolakHargaKatalog()`** — menolak harga di bawah Rp 1.000. Penolakan, bukan
  peringatan. Diukur: nol produk sah di bawah ambang itu, termurah Rp 5.000.
- **`periksaLonjakanHarga()`** — meminta satu konfirmasi kalau harga bergeser
  lebih dari 50%. **Peringatan, bukan blokir**: harga turun separuh memang
  terjadi (obral besar, barang display), dan memblokirnya membuat staff mencari
  jalan lain yang tidak terpantau.

Ambang 50% diukur dari kesalahan yang benar-benar terjadi, bukan dipilih karena
bulat. Dari log aktivitas web 2 Juli – 9 September 2026, salah jumlah nol adalah
kesalahan **rutin** — enam kasus, semuanya tertangkap staff sendiri tapi hanya
karena kebetulan ada yang melihat:

```
15.500.000 -> 1.660.000     (-89%)   HP Victus FA2716TX
 8.800.000 ->   900.000     (-90%)   IdeaPad Slim 14AMN8
   670.000 ->    70.000     (-90%)   Gamepad Rexus Ezoth
   850.000 ->       950    (-100%)   Processor i7 4790
17.300.000 -> 173.000.000  (+900%)   Lenovo LOQ 15IRX9
31.999.000 -> 319.990.000  (+900%)   VGA Zotac RTX 5080
```

Keenamnya tertangkap ambang 50%; hanya satu (`-> 950`) yang juga kena penjaga
Rp 1.000. Perubahan sah terjauh di log yang sama +37%, jadi tidak ada harga
wajar yang terhalang.

Bentuk kembalian `updateProductPriceAction` saat lonjakan terdeteksi mengisi
**`error` DAN `perluKonfirmasi`**. Itu disengaja: kalau hanya `perluKonfirmasi`,
pemanggil lama yang cuma memeriksa `error` akan menyimpulkan penyimpanan
berhasil padahal harganya tidak pernah ditulis.

---

## 5. Penautan Accurate ↔ produk web

Penautannya **sehat dan tidak boleh dibongkar.** Yang rusak harganya, bukan
tautannya — dugaan "lepas saja semua tautan" sudah diperiksa dan salah.

### Di mana staff menautkan

| Tempat | Untuk |
|---|---|
| Dialog penautan di `/admin/harga-accurate` | Mengerjakan antrean dari sisi barang Accurate |
| Quick Edit di `/admin/produk` | Menautkan produk yang sudah ada |
| Formulir produk (`/admin/produk/baru` & edit) | **Sejak 21 September 2026** — supaya barang baru ditautkan saat dibuat, bukan menunggu dikerjakan belakangan |

Ketiganya bermuara ke `tautkanKode`, jadi penjaganya sama: kodenya harus ada di
Accurate, dan tidak boleh sudah menambat produk lain.

**Formulir produk BARU menempuh urutan terbalik**, dan itu bukan pilihan:
`tautkanKode` mencocokkan `WHERE woo_id`, sedangkan produk yang belum tersimpan
belum punya satu pun. Jadi kodenya cuma **diperiksa** saat isian ditinggalkan
(`periksaKode`, baca-saja), lalu ditautkan sesudah produknya tersimpan. Kalau
penautan tetap gagal di detik terakhir, produknya tetap jadi — staff dibawa ke
halaman edit produk itu, karena di sanalah kolomnya bisa langsung diisi ulang.
Mengulang simpan hanya akan membuat produk kedua.

`periksaKode` adalah pemeriksaan, **bukan jaminan**: antara diperiksa dan
ditautkan, orang lain bisa memakai kode yang sama. Penjaga sesungguhnya tetap di
`tautkanKode`.

### Penambatnya: `products.accurate_code`

Kolom `@unique`, nullable. Sekali ditautkan manusia, tepat selamanya — tidak ada
pencocokan ulang berdasarkan kemiripan nama, tidak ada skor kepercayaan.

Kenapa bukan yang lain:

- **`sku`** — hanya 26% produk web mengisinya. Menariknya, 899 di antaranya
  **berisi kode Accurate**, dan 863 sudah tertaut lewat jalur itu. Sisanya 35
  pasang masih bisa dipanen (§7).
- **`barcode_ean`** — 51% barang Accurate punya, tapi produk web **tidak punya
  kolomnya sama sekali**.
- **Kemiripan nama** — sudah dicoba, hasilnya `accurate_woo_mapping` yang 1.092
  barisnya berskor 100 justru menunjuk `woo_product_id = 0`, produk yang tidak
  ada. **Skor tinggi di tabel itu bukan tanda benar.** Jangan hidupkan lagi jalur
  itu untuk harga.

### Keadaan, 18–19 September 2026

| | Jumlah |
|---|---|
| Barang di `accurate_products` | 7.189 |
| — aktif | 6.032 |
| — tertaut ke produk web | 984 |
| — **di antaranya tautan mati** (Accurate nonaktif atau produk web ditutup) | **229** |
| — tertaut & sehat | **755** |
| Antrean kerja (aktif, belum tertaut) | 5.163 |
| — di antaranya pernah punya harga | 1.606 |

**229 tautan mati itu belum dilepas.** Skripnya sudah ada dan bawaannya uji
kering: `scripts/lepas-tautan-accurate-mati.mts`. Angka 231 yang pernah beredar
sudah usang.

### Awalan kode: dahulukan `2`, awalan `1` skema lama

**Diukur 21 September 2026** (`scripts/laporan-awalan-kode.mts`, baca-saja):

| Awalan | Total | Tidak aktif | Tertaut | Sisa antrean |
|---|---|---|---|---|
| **2** | 5.665 | 51 (**0,9%**) | 1.058 | **4.555** |
| **1** | 1.474 | 1.061 (**72,0%**) | 164 | 354 |
| lainnya | 50 | 45 | 2 | 4 |

Kolom **Tertaut** di atas menghitung seluruh baris tanpa memandang `STATUS`,
jadi jangan langsung dibandingkan dengan tabel "Keadaan, 18–19 September 2026"
di bawah — keduanya memakai penyebut yang berbeda.

Awalan `1` adalah penomoran skema lama. Schema.prisma mencatat 71% tidak aktif
saat kolom `accurate_code` dibuat (8 September); ukur ulang dua pekan kemudian
memberi **72,0%** — angkanya bertahan, bukan kebetulan sesaat.

**Akibatnya untuk urutan kerja: hampir tidak ada yang perlu diatur.** Dari 4.913
sisa antrean, **4.555 (93%) sudah berawalan `2`**. Mendahulukan awalan `2`
terjadi dengan sendirinya — tidak perlu penyaring khusus, dan menambahkannya
hanya akan jadi tombol yang nyaris tidak mengubah apa pun.

Yang justru bernilai dari angka ini dua hal lain:

- **354 barang berawalan `1` yang masih aktif** di antrean. Kandidat kuat untuk
  ditandai "tidak dijual di web" — tapi harus dilihat manusia dulu, karena
  "berkode lama" tidak otomatis berarti "barang mati".
- **164 produk web sudah tertaut ke kode berawalan `1`.** Sebagian kemungkinan
  termasuk 229 tautan mati yang menunggu dilepas.

**Klausa yang dicabut.** Komentar `schema.prisma` dulu juga menyatakan: *"kalau
satu produk punya padanan berawalan 1 dan 2, yang dipakai berawalan 2"*. Dicari
lewat nama persis antar baris `accurate_products`: **nol pasangan**. Nama persis
instrumen yang lemah — jadi ini bukan bukti pasangannya tidak ada — tapi aturan
yang tidak bisa ditunjukkan satu pun contohnya tidak layak dipakai memutuskan
penautan. Kalau pasangan itu suatu saat ditemukan, tulis kembali beserta
contohnya.

### Cara mengerjakan sisanya: kategori mempersempit, nama memutuskan

Harga **tidak dipakai sama sekali** untuk mencocokkan.

| Lapisan | Perannya |
|---|---|
| **Kategori** | mempersempit ruang cari dari 5.475 produk jadi puluhan, dan staff punya konteks |
| **Nama** | yang memutuskan pasangannya di dalam ruang sempit itu |
| **Harga/SP** | hanya penanda "barang ini nyata" untuk memilih urutan kerja (§2) |

Laporan kemajuannya: `scripts/laporan-tautan-per-kategori.mts` (baca saja, aman
diulang).

### Barang Accurate tanpa produk web: cukup ditandai

Keputusan pemilik project yang masih berlaku: barang Accurate yang tidak punya
produk web **tidak dibuatkan produk draft**. Yang dibutuhkan cuma keterangan —
ada di web, atau belum.

Karena itu tabel Update Harga punya penanda status per baris. Gunanya dua: staff
tahu barang mana yang percuma diurus harganya karena belum ada di katalog, dan
daftar "belum ada di web" itu sendiri menjadi antrean kerja penautan.

**Penandaan massal, sejak 21 September 2026.** Dengan antrean ribuan baris, yang
melelahkan bukan menekan tombolnya melainkan menjawab dialog konfirmasi satu per
satu. Tabel Update Harga sekarang punya centang per baris dan "pilih semua yang
bisa dipilih di halaman ini", mengikuti pola yang sudah dipakai daftar produk.

Empat hal yang dijaga, semuanya sengaja:

- **Baris yang masih tertaut tidak bisa dicentang.** Menandai "tidak dijual di
  web" untuk sesuatu yang sedang dijual di web adalah dua pernyataan yang
  bertentangan — `abaikanKode` memang menolaknya, tapi mematikan centangnya
  sejak awal mencegah orang memilih 50 baris lalu menerima laporan bahwa
  separuhnya dilewati.
- **Dua query untuk berapa pun jumlahnya**, bukan perulangan versi satuan. Satu
  SELECT memvalidasi seluruh kode, satu INSERT multi-baris menulisnya. Mengulang
  `abaikanKode` berarti 3 query per kode, dan sambungan database di Hostinger
  bukan sumber daya yang berlimpah.
- **Pembatalan juga massal.** Kalau menandai bisa borongan sedangkan
  membatalkannya harus satu per satu, salah centang 200 baris berarti 200 kali
  klik untuk membereskannya — dan orang akan membiarkannya.
- **Batas 200 kode per aksi** (`BATAS_MASSAL`), dan yang melebihinya **ditolak
  utuh, bukan dipotong diam-diam**. Memotong berarti sebagian pilihan orang
  hilang tanpa ia tahu yang mana.

Hasilnya dilaporkan per kode, dikelompokkan menurut sebab: "N ditandai, M
dilewati (K — masih tertaut ke produk web)". Aksi massal yang cuma menjawab
"berhasil" menyembunyikan justru bagian yang perlu diketahui.

Diverifikasi di database uji lewat `scripts/uji-abaikan-massal.mts` — 13 uji,
termasuk kode tertaut yang harus dilewati, duplikat dalam satu permintaan, dan
penolakan saat melebihi batas.

### Jebakan yang harus dihadapi rancangan apa pun

Nama persis **tidak menolong**: dari ~1.600 barang antrean, yang namanya sama
persis dengan produk web cuma **1**. Penulisannya beda dunia:

```
ACC: Mouse Logitech M171 Wireless Mouse - Grey
WEB: MOUSE LOGITECH M171 WIRELESS - GREY
```

Dan yang lebih berbahaya: web punya M171 varian `- GREY`, `- BLUE`,
`- BLUEGREY`, `- OFFWHITE`, `- RED`. Nama Accurate itu mirip ke **kelimanya**.
Mesin akan memilih salah warna, dan akibatnya bukan "gagal" — melainkan harga
barang A menempel di barang B, tanpa galat, tanpa suara.

**Karena itu: mesin boleh mengurutkan, tidak pernah memilih.** Aturan keras
untuk fitur usulan pasangan (belum dibangun, §7):

- Nol pra-centang, termasuk kandidat teratas.
- Mesin tidak pernah menulis tautan sendiri.
- Tidak ada tombol "terima semua usulan".
- Tampilkan **semua** kandidat yang lolos ambang, bukan satu tebakan terbaik.
- Varian model yang sama ditampilkan berdampingan dengan pembedanya disorot.
- Tampilkan **alasan** tiap kandidat (token mana yang cocok), **bukan skor**.
- Peringatan eksplisit saat ≥2 kandidat hanya beda di token varian.

---

## 6. Jebakan: `SYNC_PRICE` dipakai dua fitur

**`product_logs.action = 'SYNC_PRICE'` ditulis oleh dua jalur yang berbeda:**

| Penulis | Berkas |
|---|---|
| Sinkronisasi WooCommerce | `lib/api/woocommerce/sync/apply.ts` |
| Penerapan Accurate (kini mati) | `admin/(panel)/harga-accurate/actions.ts` |

Labelnya di `lib/logs/actions.ts` bahkan berbunyi `"Sinkron Harga (WooCommerce)"`.

### Akibatnya: penjaga "suntingan manusia menang" bocor

`lib/services/accurate-price.ts` menentukan "harga ini milik manusia" dengan
membandingkan `MAX(UPDATE_PRICE)` vs `MAX(SYNC_PRICE)` per produk. Karena
1.069 entri WooCommerce menyamar sebagai jejak sinkronisasi, produk yang
harganya disunting manusia lalu tersentuh sinkronisasi WooCommerce akan dianggap
"milik sync" dan **kehilangan perlindungannya**.

Gejalanya senyap — tidak ada galat, harga hanya kembali ke angka lama.

**Belum diperbaiki.** Yang dibutuhkan pemisahan nama aksi (misal
`SYNC_PRICE_ACCURATE`), bukan mempensiunkan `SYNC_PRICE` — satu pemakainya punya
1.069 baris sejarah. Menunggu keputusan apakah entri lama ikut dilabeli ulang.

Catatan kalau jalur Accurate dihidupkan lagi: `product_logs.product_id` menyimpan
**wooId**, bukan `products.id`.

---

## 7. Yang belum dikerjakan

| Pekerjaan | Keterangan |
|---|---|
| **Lepas 229 tautan mati** | Skrip siap, uji kering dulu |
| **Panen 35 pasang SKU** | `sku` = kode Accurate, nol ambigu. Pastikan tidak bersinggungan dengan kasus ZZ TEST |
| **Ukur ulang laporan per kategori** | Setelah dua poin di atas |
| **Usulan pasangan** di dialog penautan | Aturan kerasnya di §5. Uji di `u859138789_restore_uji` dulu. Ukur akurasi pakai 863 pasang SKU sebagai kunci jawaban — berapa sering kandidat benar masuk 3 teratas. Catat: kunci jawaban itu **bias** (produk ber-SKU cenderung penamaannya rapi) dan harus dibersihkan dulu dari 229 tautan mati |
| **Pisahkan nama aksi `SYNC_PRICE`** | §6, menunggu keputusan |

> **Dua baris dicoret dari daftar ini, 21 September 2026.** *Kolom Harga Jual*
> sudah selesai di commit `4938722`, lengkap dengan penanda "harga jual di bawah
> modal" — ia masih tertulis sebagai pekerjaan sampai hari ini, dan daftar yang
> memuat pekerjaan selesai lama-lama tidak dipercaya seluruhnya. *Kolom kode
> Accurate di formulir produk* selesai hari yang sama; rinciannya di §5.

### Menunggu keputusan pemilik project

- **Asus TUF F16 (`2605000073`, FX607VJB)** — web Rp 18.600.000, Accurate
  Rp 21.900.000, modal Rp 14.800.000. Tautannya sudah diperiksa dan **benar**,
  jadi ini beda harga sungguhan, bukan salah pasang. Menurut §1 web yang
  berlaku, tapi konsekuensinya perlu disadari: pembeli yang melihat 18,6jt di
  web akan ditagih 21,9jt oleh kasir. **Jangan ubah sebelum dikonfirmasi.**

---

## 8. Cara mengerjakannya

- **Semua percobaan di database uji dulu**, bukan produksi:
  `u859138789_restore_uji`, env `RESTORE_UJI_DATABASE_URL` di `.env.local`
  (lokal saja).
- **Semua skrip tulis ke produksi**: uji kering + pratinjau + backup pemulihan,
  lalu pemilik project yang menjalankan `--tulis`.
- **Jangan menebak nilai harga yang rusak.** Angka mencurigakan ditandai, tidak
  dikoreksi diam-diam.
- **Pertahankan audit log** di `updateProductPriceAction`.
- **Harga modal (CP) & dealer tidak pernah ikut ke web.** Keduanya internal, dan
  modal punya izinnya sendiri (`harga-modal`) sejak 7 September 2026.

---

## 9. Rujukan

- `docs/08-database-migrations.md` — prosedur migrasi (`migrate dev` dan
  `db push` dua-duanya dilarang)
- `docs/12-kendala-terbuka.md` — kendala yang masih terbuka
- `src/lib/api/accurate/` — impor Sheet, akses `accurate_products`, tabel harga
- `src/lib/api/woocommerce/products.ts` — `tolakHargaKatalog`,
  `periksaLonjakanHarga`
- `scripts/laporan-tautan-per-kategori.mts`,
  `scripts/lepas-tautan-accurate-mati.mts`
- CLAUDE.md §2.2 (Prisma sumber tunggal produk) & §2.7 (aturan harga)
