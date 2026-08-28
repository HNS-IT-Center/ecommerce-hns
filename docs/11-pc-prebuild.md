# PC Prebuild — Paket Rakitan Siap Pakai

> Baca ini sebelum menyentuh apa pun di `/admin/pc-prebuild`, `/pc-prebuild`, atau
> pemuatan preset di `/build-pc`.
>
> Dibangun 19–20 Agustus 2026. Dokumen ini memuat **keputusan beserta alasannya**,
> karena beberapa di antaranya terlihat seperti detail sepele padahal justru
> menahan kerusakan yang sudah pernah terjadi di tempat lain di repo ini.
>
> **Status per 28 Agustus 2026 — lengkap.**
> Panel admin dirombak total 26 Agustus: deck kartu di `/admin/pc-prebuild`,
> editor per paket di `/admin/pc-prebuild/[id]`, daftar game di rutenya sendiri.
> Halaman pelanggan (`/pc-prebuild` dan `/pc-prebuild/[id]`) dibangun ulang
> 28 Agustus — rinciannya di §11, termasuk "Masukkan Keranjang" yang sebelumnya
> tercatat sebagai keputusan yang belum diambil.

---

## 1. Apa ini, dan bukan apa

Paket rakitan yang disusun staff, lalu **dimuat ke wizard PC Builder yang sudah
ada** dan boleh diubah pelanggan sebelum memesan.

Ia **bukan** produk baru di katalog. Tidak ada SKU "Gaming 10 Juta"; yang ada
adalah daftar komponen yang menunjuk produk-produk katalog yang sudah ada.

Alurnya:

```
/admin/pc-prebuild          DECK kartu — satu kartu per paket, satu kartu "+",
        │                   satu kartu Daftar Game. Sakelar Tayang di kepala.
        ├─ /baru            editor paket baru (id dibuat di server)
        ├─ /<id>            EDITOR satu paket, dibaca atas ke bawah:
        │                     1 nama & foto
        │                     2 komponen  (varian, jumlah, multi-barang)
        │                     3 analisis  (AI → matriks FPS → chart berfilter)
        └─ /games           daftar game untuk grid FPS
        ↓
/pc-prebuild                DECK kartu dua sisi — depan: foto + komponen,
        │                   belakang: kecocokan + FPS berfilter
        └─ /<id>            DETAIL: galeri, panel performa, isi paket,
                            bilah aksi (keranjang / ubah rakitan)
        ↓
/build-pc?preset=<id>&pick=…  memuat paket ke wizard
keranjang → /checkout → WhatsApp CS   (paket sebagai satu blok bernama)
```

---

## 2. Bentuk data

**Tidak ada tabel baru.** Seluruhnya satu baris di tabel `settings` dengan kunci
`PC_PREBUILD_CONFIG`, mengikuti pola `PC_BUILDER_CONFIG`.

```ts
{
  enabled: boolean,
  presets: [{
    id: string,
    name: string,
    summary: string,
    images: string[],            // URL R2; yang pertama = foto utama
    order: number,
    slots: [{
      stepId: string,            // menunjuk step di PC_BUILDER_CONFIG
      items: [{                  // terpasang BERSAMAAN — dua NVMe = dua items
        productId: number,       // id INDUK (SIMPLE atau VARIABLE)
        variationId?: number,    // baris VARIATION, kalau induknya bervarian
        quantity: number,
        label?: string,
        alternatives: [{ productId, variationId?, quantity, label? }]
      }]
    }],
    performance?: { … }          // hasil analisis AI — opsional, lihat §9
  }]
}
```

### `items` dan `alternatives` — dua hal yang sering tertukar

- **`items`** terpasang **bersamaan**. Semuanya ikut dalam rakitan dan ikut
  dalam total. Ini yang membuat "satu NVMe cepat untuk sistem + satu NVMe besar
  untuk data" bisa dinyatakan sama sekali.
- **`alternatives`** adalah pilihan **tukar** untuk satu barang. Pelanggan
  memilih salah satu; barangnya sendiri adalah bawaannya.

Generasi sebelumnya cuma punya `options`, yang artinya "pilihan tukar" — jadi
dua barang sekaligus dalam satu langkah memang tidak bisa dinyatakan.

Sejak 28 Agustus 2026 pilihan tukar bisa dipilih pelanggan langsung di halaman
paket (`ComponentPicker`), dan pilihannya ikut ke dua tempat sekaligus: ke
keranjang, dan ke `?pick=` saat paketnya dibuka di wizard.

### Varian: `productId` induk, `variationId` variannya

Yang menentukan **harga dan stok adalah variannya**, bukan induknya — induk
VARIABLE sering berharga nol. Karena baris VARIATION juga sebuah `Product`, ia
diambil lewat pencarian id yang sama; tidak ada jalur kedua yang harus dijaga.

Yang dikirim ke AI justru **id induknya**: kategori dan nama yang menjelaskan
komponen menempel di induk, sementara baris varian biasanya cuma mengulang nama
induk plus satu nilai atribut dan sering tidak berkategori.

Daftar game untuk grid FPS TIDAK tinggal di sini melainkan di baris `settings`
sendiri berkunci `PC_PREBUILD_GAMES` — ia satu daftar untuk semua paket, dan
menyimpannya bersama paket berarti menyunting satu nama game ikut menuliskan
ulang seluruh konfigurasi paket. Pola yang sama dipakai `PC_BUILDER_DISPLAY`
terhadap `PC_BUILDER_CONFIG`.

### Dua bentuk masuk, satu bentuk keluar

`parsePrebuildConfig()` menerima bentuk lama **dan** baru, tapi selalu
mengeluarkan bentuk baru:

| Gen | Bentuk | Dibaca jadi |
|---|---|---|
| 1 | `items: [{ stepId, productId, quantity }]` (di level **preset**) | satu slot berisi satu barang |
| 2 | `slots: [{ stepId, options: [...] }]` | `options[0]` jadi barang, sisanya jadi `alternatives`-nya |
| 3 | `slots: [{ stepId, items: [...] }]` | apa adanya |
| — | `image: "…"` (satu URL) | `images: ["…"]` |

Migrasi gen 2 → 3 **wajib** membaca `options[0]` sebagai barang dan sisanya
sebagai pilihan tukar. Membacanya sebagai beberapa barang terpasang akan
**menggandakan komponen** — paket RAM 16/32 GB tiba-tiba berisi dua keping
sekaligus, dan totalnya naik tanpa ada yang mengubah apa pun.

`savePcPrebuildConfig()` menjalankan parser itu **sebelum menulis**, jadi setiap
penyimpanan menormalkan datanya. Tanpa itu, dua bentuk akan hidup berdampingan di
kolom JSON selamanya dan setiap pembaca berikutnya harus tahu keduanya.

**Kalau menambah bentuk lagi nanti, ikuti pola yang sama.** Jangan menulis skrip
migrasi untuk kolom JSON — parser yang toleran lebih murah dan tidak bisa gagal
separuh jalan.

---

## 3. Harga — baca ini sebelum mengubah apa pun

**Preset tidak pernah menyimpan harga.** Isinya hanya `productId`, `variationId`,
dan `quantity`.

Ini keharusan [CLAUDE.md §2.7](../CLAUDE.md), bukan pilihan gaya. Preset yang
menyimpan angka akan menampilkan harga yang benar hari ini dan salah bulan depan
tanpa ada yang menyadarinya — persis yang pernah terjadi pada panel "My Build"
yang membaca harga dari localStorage (diperbaiki di commit `9f45230`).

Ada **tiga lapis** harga, dan bedanya disengaja:

| Kapan | Sumber | Bisa basi? |
|---|---|---|
| Kartu, halaman detail, panel admin | Katalog lewat cache bertag `pc-prebuild-products` | Tidak — disegarkan saat produk diubah |
| Rakitan yang **disimpan** pelanggan | Harga acuan saat disimpan | **Sengaja** — justru itu yang membuat "harga telah berubah" bisa diberitahukan |
| Saat memesan (WhatsApp) | `priceCartFromCatalog`, tanpa cache | Tidak pernah |

Penjumlahan di klien (halaman detail saat pelanggan menukar varian) **boleh**,
karena ia hanya menjumlahkan harga satuan yang dikirim server dari katalog. Yang
dilarang adalah menurunkan harga baru dari rumus — perkalian, persentase,
potongan. Pengamannya tetap di server: `prepareBuildWhatsApp` menghitung ulang
seluruhnya saat memesan.

---

## 4. Batas, dan kenapa segitu

Di [`lib/pc-prebuild/limits.ts`](../src/lib/pc-prebuild/limits.ts) — berkas
terpisah, lihat §7.

| Batas | Nilai | Alasan |
|---|---|---|
| `MAX_ITEMS_PER_SLOT` | 4 | Langkah yang butuh lebih dari empat barang berbeda sebenarnya dua langkah yang tergabung |
| `MAX_ALTERNATIVES_PER_ITEM` | 3 | Tiga barang bercabang × tiga pilihan sudah 27 kombinasi harga di satu halaman |
| `MAX_BRANCHING_ITEMS` | 3 | Lebih dari itu halaman paket berubah jadi konfigurator — dan untuk itu sudah ada PC Builder |
| `MAX_QUANTITY_PER_ITEM` | 10 | Jauh di atas kebutuhan nyata (4 keping RAM, 6 kipas); angkanya ikut ke pesan WhatsApp yang diterima CS |
| `MAX_PREBUILD_IMAGES` | 4 | Satu utama + tiga pendamping: depan, dalam casing, tata kabel, belakang |

Batasnya ditegakkan **di parser**, bukan cuma di UI. Data yang masuk lewat jalur
mana pun tetap patuh. Barang bercabang yang melebihi batas **dikunci ke
bawaannya**, bukan dibuang — paketnya tetap utuh, cuma berhenti bercabang.
Jumlah yang kelewat besar **dijepit**, bukan ditolak.

### Satu batas yang SENGAJA tidak ditegakkan parser: `allowMultiple`

`PcBuilderStepConfig.allowMultiple` menentukan boleh-tidaknya satu langkah diisi
lebih dari satu barang. Panel prebuild mematuhinya dengan **menonaktifkan tombol
"Tambah barang"**. Parser **tidak** ikut menegakkannya, dan itu disengaja:
sakelar itu bisa dimatikan staff kapan saja di `/admin/pc-builder`, dan parser
yang mematuhinya akan diam-diam menghapus komponen dari paket yang sudah
tersusun — perubahan di satu halaman merusak data di halaman lain.

---

## 5. Aturan yang tidak boleh dilanggar

### URL membawa `productId`, BUKAN indeks

Pilihan varian dibawa ke wizard sebagai `?pick=<stepId>:<productId>,…`.

Indeks akan berkhianat diam-diam: begitu staff mengurutkan ulang atau menghapus
satu pilihan di panel admin, setiap tautan yang sudah tersebar lewat WhatsApp
menunjuk produk lain. Pelanggan membuka tautan "RAM 32GB" minggu depan dan
mendapat 16GB — tanpa error, tanpa ada yang tahu.

Konsekuensinya: **`productId` tidak boleh kembar dalam satu slot.** Dua tombol
"Samsung 1TB" tidak bisa dibedakan. Parser membuang yang kembar, dan panel admin
menyembunyikan produk yang sudah dipakai pilihan lain di slot yang sama.

Saat memuat: `productId` yang **tidak ada** di daftar pilihan slot itu **jatuh ke
bawaan**, bukan dipaksakan masuk.

### Bawaan, produk hilang, dan stok

- Bawaan = pilihan **pertama**.
- Kalau produk bawaan **dihapus dari katalog**, bawaan jatuh ke pilihan tersedia
  berikutnya — bukan menampilkan slot rusak.
- Kalau **semua** pilihan di slot itu hilang, slot ditandai dan totalnya diberi
  label "(sebagian)". Tidak disembunyikan: menyembunyikannya membuat staff
  mengira paketnya masih utuh, dan pelanggan melihat total yang tidak menjelaskan
  kenapa lebih murah.
- **Stok kosong TIDAK memindahkan bawaan.** Tetap pilihan pertama, ditandai,
  tetap bisa dipilih — pelanggan bisa menukarnya di wizard. Bawaan yang berpindah
  sendiri karena stok membuat staff melihat paket yang berbeda dari yang ia susun.

### Sakelar mati bukan berarti terhapus

`enabled: false` → `/pc-prebuild` melempar ke `/build-pc`, tautan menu tidak
dirender, `?preset=` diabaikan. **Presetnya tetap tersimpan.** Pola yang sama
dipakai `REGISTER_MANUAL_ENABLED`.

Bawaannya `false`. Lingkungan yang belum pernah menyimpan konfigurasi tidak boleh
diam-diam menerbitkan halaman berisi paket kosong.

### Memuat preset ke wizard: muat kalau kosong, tanya kalau ada isinya

Store builder menyimpan rakitan di localStorage. Menimpanya diam-diam berarti
membuang pekerjaan orang tanpa peringatan; selalu bertanya berarti menambah
dialog pada jalur yang seharusnya satu klik.

Pemuatannya **wajib menunggu `mounted`**. Isi store baru terbaca setelah hydration
Zustand persist selesai — sebelum itu store selalu terlihat kosong, dan rakitan
pelanggan tertimpa tanpa sempat ditanya.

---

## 6. Foto

Diunggah ke **Cloudflare R2** lewat `POST /api/admin/media` — satu-satunya jalur
unggah foto di project ini (CLAUDE.md §2.2). Dikompres dulu di browser.

Beda dari form produk, unggahannya terjadi **saat foto dipilih**, bukan ditahan
sampai "Simpan". Form produk menahannya karena staff sering menambah lalu
membatalkan banyak gambar sekaligus sehingga R2 penuh berkas yatim; di sini
jumlahnya sedikit, dan menahannya membuat pratinjaunya hilang setiap kali panel
dirender ulang. **Konsekuensinya diterima:** foto yang diunggah lalu dihapus
meninggalkan berkas tak terpakai di R2.

Foto **opsional**. Paket tanpa foto tetap tampil dengan daftar komponen berikon.
Ikonnya dicocokkan dari **nama langkah** (`Cpu`, `CircuitBoard`, `MemoryStick`,
…), bukan satu ikon seragam untuk semua — ikon identik di setiap baris bukan
informasi, cuma pengisi ruang.

---

## 7. Empat jebakan teknis yang sudah menggigit

**1. `limits.ts` terpisah dari `config.ts`, dan itu wajib.**
Panel admin adalah Client Component. Mengimpor **nilai** dari `config.ts`
menyeret `getPrisma()` ke bundle browser dan menggagalkan build Turbopack.
Mengimpor **tipe** aman karena terhapus saat kompilasi. `limits.ts` tidak
mengimpor apa pun.

**2. Jangan impor `type` dari berkas `"use server"`.**
Turbopack memperlakukan setiap export di dalamnya sebagai server action —
termasuk `export type`. Build gagal dengan "Export … doesn't exist in target
module". Deklarasikan ulang tipenya di pemanggil. Berlaku untuk
`actions-whatsapp.ts` dan `actions-save.ts`.

**3. Wizard PC Builder MENGUNCI `type: "SIMPLE"` — panel prebuild tidak.**
`fetchBuilderProducts` di `features/builder/actions.ts` menyaring habis produk
VARIABLE beserta variannya, jadi di wizard skenario "pilih produk lalu pilih
variannya" memang tidak pernah terjadi. Panel prebuild membutuhkannya, dan
karena itu ada jalur query TERPISAH di
[`lib/pc-prebuild/products.ts`](../src/lib/pc-prebuild/products.ts).

**Jangan "menyederhanakan" dengan melonggarkan filter di `fetchBuilderProducts`.**
Wizard dipakai pelanggan dan tidak punya UI untuk memilih varian; produk
VARIABLE yang bocor ke sana akan masuk keranjang tanpa varian — harganya nol
atau harga induk yang bukan harga barang mana pun. Perhatikan juga bahwa induk
VARIABLE sering berharga nol, jadi query prebuild harus punya cabang `OR`
khusus untuk induk yang variannya berharga; tanpa itu seluruh produk bervarian
hilang justru dari panel yang dibuat untuk menanganinya.

**4. `product.id` internal, BUKAN `wooId`.**
`fetchBuilderProducts` mengembalikan `id: p.id`, dan itulah yang masuk ke store
wizard — jadi preset memakai kunci yang sama. Tapi `getProductById()` di
`lib/api/woocommerce/products.ts` justru mencari lewat `wooId`. Dua kunci hidup
berdampingan di repo ini; memakai yang keliru menghasilkan "produk tidak
ditemukan" yang membingungkan.

> **`tsc --noEmit` tidak menangkap nomor 1 dan 2.** Hanya `next build` yang
> menangkapnya. Jalankan build sebelum commit kalau menyentuh berkas ini.

---

## 8. Cache

| Tag | Isi | Disegarkan oleh |
|---|---|---|
| `pc-prebuild-config` | Konfigurasi paket (termasuk hasil analisis performa) | `savePcPrebuildConfig()` |
| `pc-prebuild-products` | Harga & stok komponen | `invalidateProductCaches()` — helper terpusat yang dipakai SEMUA jalur perubahan produk |
| `pc-prebuild-games` | Daftar game grid FPS | `savePcPrebuildGames()` |

`revalidateTag`, **bukan** `revalidatePath`. Alasannya sama seperti di
`pc-builder/actions.ts`: halaman yang memegang entri invalidasi path sendiri
berhenti ikut tersegarkan oleh `revalidatePath("/", "layout")` milik tema —
gejalanya, mengganti tema terlihat di seluruh situs kecuali di halaman itu.

---

## 9. Analisis performa (Groq)

Ditambahkan 24 Agustus 2026. Satu klik di panel admin mengirim komponen paket
ke Groq, dan hasilnya jadi panel "Estimasi Performa" di halaman paket: kelas
resolusi, kecocokan per use case, estimasi FPS per game, keseimbangan CPU/GPU,
dan saran upgrade.

```
/admin/pc-prebuild/<id>  →  "Analisis dengan AI"  →  ConfirmDialog
        ↓                                             (menyebut jumlah sel
        ↓                                              yang akan dihitung)
POST /api/admin/pc-prebuild-performance      (requireAuth)
        └─ SATU panggilan  openai/gpt-oss-120b
             kelas resolusi + kecocokan use case + matriks FPS + bottleneck
        ↓
hasil masuk sebagai DRAF di state editor     (published: false)
        ↓  staff menyunting angka bila perlu, lalu menyalakan "Tampilkan ke pelanggan"
"Simpan"  →  tersimpan di dalam presetnya    (PC_PREBUILD_CONFIG)
```

### Angka FPS berjangkar pada tabel acuan (28 Agustus 2026)

Empat hari pertama fitur ini, angka FPS murni ingatan model atas nama produk.
Dua akibatnya sama buruknya: melesetnya bisa berkali lipat, dan dua kali hitung
pada paket sekelas menghasilkan skala yang berbeda — sehingga tidak ada angka
yang punya alasan untuk dipercaya.

Sekarang model bekerja dari tiga penambat:

1. **Spesifikasi terurai** — [`hardware-specs.ts`](../src/lib/pc-prebuild/hardware-specs.ts)
   mengubah `"VGA GEFORCE RTX 4060 EAGLE OC 8GB"` jadi `RTX 4060, VRAM 8GB`.
   Ini juga yang membuat `32GB (2x16GB)` akhirnya terbaca sebagai dual channel,
   dan kuantitas ikut dihitung — dua keping "8GB DDR4" adalah 16GB dual
   channel, bukan 8GB single channel.
2. **Tabel acuan** — [`performance-reference.ts`](../src/lib/pc-prebuild/performance-reference.ts):
   tangga GPU pada 1080p Medium, **bobot per game**, plafon prosesor, batas
   VRAM/RAM, penskalaan antar sel. Sengaja berupa RENTANG, bukan angka tunggal:
   angka tunggal mengundang model menyalinnya bulat-bulat — cacat yang persis
   pernah terjadi di endpoint ini lewat contoh JSON.
3. **Pemeriksa kewajaran** — [`fps-plausibility.ts`](../src/lib/pc-prebuild/fps-plausibility.ts)
   menandai urutan sel yang terbalik, sel kosong, rasio 1% low yang mustahil,
   dan **angka yang seragam antar game**. Ia **menandai, tidak memperbaiki**:
   membetulkan urutan otomatis akan menyembunyikan bahwa modelnya sedang
   keliru. Peringatannya juga tidak memblokir penyimpanan — peringatan yang
   memblokir mendorong orang mengarang angka supaya lolos.

   Pemeriksaan **lintas-game** ditambahkan setelah cacat bobot di atas lolos
   sepenuhnya dari pemeriksaan per-game: tiap sel-nya wajar, urutannya benar,
   rasio 1% low-nya benar. Yang menyingkapnya hanya membandingkan antar game —
   tiga game atau lebih berangka sama persis, atau sebaran seluruh daftar di
   bawah 1,5x. Temuan lintas-game sengaja didahulukan dalam daftar supaya tidak
   terpotong `MAX_WARNINGS` pada matriks yang justru paling bermasalah.

**Tabelnya ALAT PERIKSA, bukan resep — dan itu koreksi atas percobaan kedua.**
Versi kedua (28 Agustus 2026) menyuruh model menurunkan angka lewat rantai:
titik GPU × bobot game × penskalaan resolusi × penskalaan setelan, lalu
dijepit plafon prosesor. Lima langkah, masing-masing punya rentang — dan
rentang yang bertumpuk membuat ujung bawah dan ujung atas rantai berjarak tiga
kali lipat untuk sel yang sama. Dua-duanya "sah" menurut tabel, jadi tabel yang
seharusnya menambatkan justru **melebarkan** ruang jawaban. Hasilnya dilaporkan
lebih buruk daripada sebelum tabel ada.

Yang terlewat: model sudah tahu RTX 4060 di Valorant kira-kira berapa — itu
angka yang banyak dibahas publik. Rantai perkalian membuang pengetahuan itu dan
menggantinya dengan galat yang menumpuk.

Urutannya sekarang dibalik: **model menjawab per game dari pengetahuannya, lalu
memeriksa jawabannya terhadap batas.** Yang jelas keluar batas diperbaiki; beda
tipis mengikuti perkiraan model, karena batasnya sendiri kasar. Jangan
mengembalikannya jadi rumus.

**Berat per game — jangan dihapus.** Percobaan pertama tabel acuan (28 Agustus
2026) hanya memberi SATU angka per GPU untuk "game AAA", tanpa keterangan bahwa
Valorant jauh lebih ringan daripada Red Dead Redemption 2. Hasilnya seluruh
game keluar dengan angka yang nyaris sama — Roblox disamakan dengan Apex
Legends. Yang memperbaikinya dua hal sekaligus:

- Angka TITIK PERIKSA GPU bermakna **game AAA berat**, bukan
  rata-rata semua game. Ia lantai terberat, bukan titik tengah.
- Bobot ditempelkan **ke baris game-nya sendiri** di `DAFTAR GAME`, bukan cuma
  tersedia sebagai daftar kelas terpisah. Daftar terpisah terbukti dibaca model
  sebagai keterangan lalu diabaikan; bobot yang menempel di baris yang sedang
  dikerjakan jauh lebih sulit dilewati.

Pencocokannya lewat **kata kunci pada nama, bukan id** (`gameWeightHint`) —
daftar game diatur staff dan id-nya hasil `slugifyGameId` dari nama yang mereka
ketik, jadi "Apex Legends Season 20" tetap mendapat bobot Apex. Game yang tidak
dikenali **tidak diberi bobot bawaan**: menambal dengan berat "sama" justru
mengembalikan cacat yang sedang diperbaiki, karena itu kelas terberat.

**Plafon prosesor, bukan pengurang persen.** Prosesor tidak memotong FPS dalam
persen, ia memasang batas atas: `fps = min(kemampuanGPU, plafonCPU)`. Bedanya
nyata — pada RTX 4060 dengan prosesor kelas bawah, di 1440p prosesornya tidak
merugikan sama sekali, sementara di 720p ia memotong lebih dari separuh. Satu
angka persen tidak mungkin benar di dua ujung itu sekaligus.

Konsekuensi yang **disengaja**: pada game esports dengan prosesor menengah ke
bawah, angka 720p dan 1080p bisa hampir sama. Itu jawaban yang benar, dan
`ORDER_TOLERANCE` di pemeriksa kewajaran sengaja memberi ruang untuk itu.

**Ini tetap perkiraan, bukan pengukuran.** Tabel acuannya rangkuman benchmark
publik, bukan hasil ukur HNS atas unit yang dijualnya. Kalau suatu hari teknisi
mengukur rakitan sungguhan, angka ukur itu masuk ke `performance-reference.ts`
dan seluruh analisis berikutnya ikut terkalibrasi ulang.

### Matriks FPS: 3 resolusi × 3 setelan

Sejak 26 Agustus 2026 estimasi FPS bukan lagi satu patokan tetap 1080p,
melainkan **matriks**: `PREBUILD_FPS_RESOLUTIONS` (720p/1080p/1440p) ×
`PREBUILD_FPS_QUALITIES` (Low/Medium/High) — sembilan sel per game. Chart di
panel admin memfilter dua sumbu itu.

Sumbunya **tetap**, bukan dikarang model per paket, jadi angka antar paket tetap
bisa dibandingkan. 4K sengaja tidak masuk: pada paket yang sanggup 4K angkanya
sudah bisa disimpulkan dari 1440p, dan tiap kombinasi tambahan mengalikan jumlah
angka yang harus dikeluarkan model untuk SETIAP game. "Ultra" juga tidak jadi
sumbu matriks (ia tetap sah sebagai vonis kelas paket) dengan alasan yang sama.

**Skala batang di chart TETAP** terhadap FPS tertinggi seluruh matriks, bukan
terhadap yang tertinggi pada filter yang sedang aktif. Kalau skalanya ikut
berubah, berpindah dari "1440p High" ke "720p Low" menampilkan batang sepanjang
yang sama padahal angkanya berlipat — justru perubahan panjang itulah gunanya
filter ini.

**Sel kosong ≠ nol.** Kombinasi yang tidak dihitung model ditandai "—", bukan
batang nol. Batang nol berarti "tidak sanggup menjalankan", pernyataan yang
sama sekali berbeda dari "tidak ditanyakan".

Data lama tanpa bidang `resolution` dibaca sebagai **1080p** (patokan versi
pertama), dan `quality: "Ultra"` jatuh ke `"High"` — bukan dibuang, karena
membuang barisnya berarti kehilangan angka yang sudah pernah dihitung.

### Saran upgrade DIBUANG — jangan ditambahkan kembali

Versi 24–26 Agustus 2026 sempat punya daftar saran upgrade, lengkap dengan
produk pengganti yang dipilih AI dari katalog lewat panggilan Groq kedua
(`openai/gpt-oss-20b`). **Seluruhnya dibuang 26 Agustus 2026** atas keputusan
pemilik produk.

Alasannya bukan teknis: yang mengunggah produk di HNS sudah berkompeten menilai
kelas komponen, jadi saran mesin di atas penilaian mereka tidak menambah apa
pun — sementara saran yang meleset tetap harus ditolak CS di depan pelanggan.
Fitur yang akurasinya tidak bisa dijamin dan gunanya tipis lebih baik tidak ada
daripada ada dengan peringatan.

Yang ikut terhapus: panggilan Groq kedua, `getUpgradeCandidates()`,
`MAX_UPGRADE_CANDIDATES`, `UPGRADE_CANDIDATE_POOL`, dan tipe
`PrebuildUpgrade`/`PrebuildUpgradeCandidate`. Endpoint sekarang **satu
panggilan, satu model**.

### `bottleneck` UNTUK PANEL ADMIN SAJA

Tetap dihitung dan tetap tersimpan, tapi **halaman pelanggan tidak boleh
merendernya** (keputusan yang sama, 26 Agustus 2026). Bagi pembeli, "CPU 78 /
GPU 91" bukan informasi yang bisa ditindaklanjuti, dan angka yang terbaca
seperti nilai rapor justru membuat paket yang sehat terlihat cacat. Bagi staff
yang sedang menyusun paket, ia justru penanda paling cepat bahwa ada komponen
yang menahan yang lain.

Ditandai di **tiga** tempat supaya tidak terlewat: tipe `PrebuildPerformance`,
badge "Khusus admin" di panel, dan komentar di halaman pelanggan yang masih
placeholder.

### Pilihan tukar TIDAK ikut dianalisis

Yang dibaca analisis adalah **bawaan** tiap barang — barang itu sendiri, bukan
`alternatives`-nya. Paket dengan prosesor bercabang karena itu punya satu angka
FPS yang hanya berlaku untuk prosesor bawaannya.

Menghitung seluruh kombinasi berarti satu panggilan AI per kombinasi (2 CPU × 2
RAM = 4 panggilan untuk satu paket), dan itu belum dibuat. Batasnya **ditandai
di panel** begitu ada barang bercabang, bukan dibiarkan tersirat — staff yang
tidak tahu akan mengira angkanya berlaku untuk semua pilihan.


### Katalognya TERTUTUP — AI memilih, tidak mengarang

Use case (7), tingkatan resolusi (5), setelan grafis (4), dan sumbu matriks FPS
(3 resolusi × 3 setelan) adalah daftar tetap di [`lib/pc-prebuild/performance.ts`](../src/lib/pc-prebuild/performance.ts).
AI hanya memilih dari daftar itu; id yang tidak dikenal **dibuang parser**.

Kalau labelnya boleh dikarang tiap kali dihitung, dua paket sekelas bisa
berbunyi "1440p Ultra" dan "QHD High", atau "Gaming Kompetitif" dan "Esports".
Pelanggan berhenti bisa membandingkan paket, dan flag di kartu kehilangan
artinya sebagai penanda.

### Sidik jari: analisis basi tidak pernah sampai ke pelanggan

Setiap hasil menyimpan `fingerprint` — sidik jari seluruh slot beserta urutan
pilihannya, dihitung `fingerprintSlots()`. Begitu staff mengganti satu komponen,
sidik jarinya tidak cocok lagi:

- panel admin menandai paketnya "Perlu hitung ulang" (di kepala kartu, jadi
  terlihat tanpa membuka paketnya),
- `resolve.ts` mengosongkan `performancePublic`, sehingga panelnya **hilang**
  dari halaman pelanggan sampai dihitung ulang.

Urutan pilihan ikut dihitung, karena pilihan pertama adalah bawaan — menukar
urutan berarti menganalisis komponen yang berbeda. Sidik jarinya berawalan versi
(`v1|…`) supaya perubahan format nanti otomatis membuat semua hasil lama dianggap
basi, bukan dibandingkan dengan aturan yang sudah tidak berlaku.

`resolve.ts` mengembalikan tiga bidang, dan bedanya disengaja:

| Bidang | Isi | Dipakai |
|---|---|---|
| `performance` | apa adanya, termasuk draf & basi | panel admin |
| `performanceStale` | komponen sudah berubah | panel admin |
| `performancePublic` | sudah tayang DAN belum basi | halaman pelanggan |

Penyaringannya di satu tempat, bukan diulang di tiap halaman: satu halaman yang
lupa memeriksanya sudah cukup untuk memperlihatkan draf ke pelanggan.

### Angkanya perkiraan, dan diperlakukan begitu

- `published` bawaannya **false**. Hasil AI selalu mendarat sebagai draf; yang
  memutuskan ia layak dilihat pelanggan adalah staff.
- Seluruh angka **bisa disunting** staff. Teknisi HNS tahu hal yang tidak
  diketahui model — casing berventilasi sempit, driver yang sedang bermasalah.
- Disclaimer ada **di dalam** `PerformancePanel`, bukan ditambahkan halaman
  pemanggil. Halaman yang lupa menyertakannya adalah halaman yang menampilkan
  perkiraan sebagai janji.
- Prompt melarang menyebut **harga, diskon, atau promo**. Angka rupiah dikirim
  hanya sebagai konteks kelas paket. Angka rupiah yang dikarang model persis
  jenis angka yang dilarang [CLAUDE.md §2.7](../CLAUDE.md).
- Estimasi FPS memakai **sumbu tetap** (3 resolusi × 3 setelan, lihat di atas).
  Sumbu yang berpindah-pindah membuat angka antar paket tidak bisa
  dibandingkan. Seluruh selnya bisa disunting staff lewat "Sunting angka" di
  chart — yang tersunting hanya kombinasi yang sedang ditampilkan filter.

### Peran komponen ditebak, bukan disimpan

Langkah PC Builder dinamai staff dan tidak punya kolom "peran". [`component-roles.ts`](../src/lib/pc-prebuild/component-roles.ts)
menebaknya dari nama langkah → nama kategori → nama produk, dan berkas itu
dipakai **tiga** tempat: tombol admin (menyala atau tidak), endpoint AI (menolak
paket tanpa prosesor/RAM/penyimpanan), dan ikon di kartu `/pc-prebuild`. Satu
daftar kata kunci untuk semuanya — dua daftar berarti tombol yang menyala di
panel menghasilkan penolakan dari server.

Yang **wajib** ada: prosesor, RAM, penyimpanan. GPU sengaja tidak, karena paket
kantor ber-grafis terintegrasi justru yang paling butuh penjelasan "ini cukup
untuk apa".

### Daftar game

Rute sendiri di `/admin/pc-prebuild/games`, dicapai lewat kartu khusus di deck
(bukan tab, bukan entri sidebar) — ia satu daftar untuk SEMUA paket, dan sebagai
tab ia terlihat seperti bagian dari paket yang sedang dibuka. Maksimal
12 game; logonya opsional dan diunggah ke R2 lewat `/api/admin/media` — tanpa
logo, grid memakai inisial. **Id game tidak berubah saat namanya diubah**: entri
FPS menunjuk id, jadi membetulkan ejaan tidak boleh menghapus angka yang sudah
dihitung. Entri FPS untuk game yang dihapus dari daftar disaring saat dirender,
bukan dibuang dari data.

### Batas token, dan satu pelajaran yang mahal

Penjaganya sama dengan dua endpoint AI lain di panel
([`lib/api/groq/rate-limit.ts`](../src/lib/api/groq/rate-limit.ts)): `max_tokens`
dipesan di muka terhadap jatah TPM, jadi menaikkannya justru mempersempit daftar
komponen yang masih boleh dikirim. Yang dikirim ke Groq hanya nama produk, nama
kategori, nama langkah, jumlah, dan harga — bukan tabel spesifikasi lengkap.

**Modelnya BEDA dari dua endpoint itu**, karena `llama-3.3-70b-versatile` sudah
tidak ada di akun ini (404 `model_not_found`, 24 Agustus 2026). Penggantinya
`openai/gpt-oss-120b` dengan `reasoning_effort: "low"` — token penalaran ikut
memakan `max_tokens`. Rinciannya di
[`docs/05-data-fetching.md` §10.3](./05-data-fetching.md).

**Matriks penuh muat karena SKEMA-nya dipendekkan, bukan karena ganti model.**
108 baris FPS (12 game × 9 sel) dengan kunci panjang
(`gameId`/`resolution`/`quality`/`avg`/`low`) tidak muat di model mana pun yang
tersedia di akun ini. Dengan kunci pendek (`g`/`r`/`q`/`a`/`l`) ia muat lapang —
diukur 26 Agustus 2026: prompt 672 token, keluaran **2.836 token** (52
penalaran), **5,9 detik**, 108 dari 108 sel terisi, `finish_reason: "stop"`.
`max_tokens` karena itu 4.000: memuat keluaran terukur dengan kelonggaran, tanpa
memakan jatah semenit yang masih dibutuhkan panggilan kedua.

Kuncinya tetap **eksplisit**, bukan array berurutan tanpa nama. Array berurutan
lebih hemat lagi, tapi model yang menukar urutan menghasilkan angka salah secara
diam-diam — dan angka FPS yang salah tidak punya gejala apa pun sampai ada
pelanggan yang mengeluh. Pemetaan kunci pendek → bentuk panjang tinggal di route
handler-nya saja (`padatKePanjang`); yang tersimpan selalu bentuk panjang.

**`groq/compound` sempat dipilih, lalu dibatalkan setelah diukur.** Ia terlihat
menjanjikan karena `GROQ_TPM` dan header `x-ratelimit-limit-tokens` sama-sama
menyebut 70.000. Ternyata compound bukan model melainkan **router** yang
memanggil model lain di dalamnya, dan yang mengikat adalah TPM model internal
itu:

```
429 Rate limit reached for model `meta-llama/llama-4-scout-17b-16e-instruct`
    … tokens per minute (TPM): Limit 30000, Used 27359, Requested 13501
```

`Requested 13501` untuk permintaan berisi 1.255 token input dengan `max_tokens`
8.000 — ia menggandakan pemakaian karena menjalankan beberapa model internal.
**Jangan memilih model berdasarkan angka TPM di tabel tanpa mengukur permintaan
yang sebenarnya.**

**Kalau keluarannya salah, periksa promptnya sebelum menaikkan jatah berpikir
model.** Dua cacat pertama — RDR2 hilang dari daftar FPS, dan saran upgrade
berbunyi "RAM 8 GB single channel" untuk paket yang sudah 16 GB dual channel —
terlihat seperti model yang kurang teliti. Sebabnya ternyata contoh JSON di
prompt: isinya nilai yang terlihat masuk akal, dan model menyalinnya sebagai
fakta alih-alih membaca daftar komponen. Setelah contohnya diganti placeholder
`<…>`, mutu pada penalaran rendah setara dengan penalaran medium yang memakai
tiga kali lipat token.

---

## 10. Yang belum ada

- **Catatan garansi & estimasi waktu rakit** di halaman detail. Isinya kebijakan
  HNS, bukan sesuatu yang boleh dikarang.
- **Kategori paket** (gaming / kantor / editing) kalau jumlah paketnya bertambah
  banyak.
- **Analisis performa per kombinasi pilihan tukar.** Yang dianalisis tetap
  bawaannya saja (§9); pelanggan yang menukar prosesor melihat angka FPS yang
  sebenarnya berlaku untuk prosesor bawaan.
- Halaman ini masih **daftar paket**, bukan halaman jualan bergaya editorial.
  Mengubah ke sana butuh foto rakitan yang bagus dan naskah — bukan pekerjaan CSS.

---

## 11. Halaman pelanggan (28 Agustus 2026)

### `/pc-prebuild` — kartu dua sisi

Sisi depan menjawab "isinya apa", sisi belakang menjawab "sanggup apa". Keduanya
menerangkan paket yang SAMA, dan itulah alasan mereka satu kartu yang digeser
alih-alih dua kartu bersebelahan: dua kartu terpisah membuat orang membandingkan
sisi belakang paket A dengan sisi depan paket B.

- **Depan** — foto, nama, lalu daftar komponen berikon yang digulir.
- **Belakang** — chip kecocokan penggunaan, dua baris filter (3 resolusi ×
  3 setelan), lalu daftar game: logo di kiri, `FPS rata-rata / 1% low` di kanan.
  **Angka, bukan chart.** Yang dicari di daftar paket adalah sesuatu yang bisa
  langsung dibandingkan antar kartu; batang butuh ruang yang di kartu tidak ada.
  Chart-nya tetap ada di halaman detail.
- Paket **tanpa `performancePublic` tidak punya sisi belakang** sama sekali —
  tombol gesernya pun tidak dirender. Sisi kosong berisi "belum dianalisis" cuma
  memberi tahu pelanggan tentang pekerjaan internal HNS yang bukan urusannya.
- Kartu paket bercabang menampilkan **"mulai dari" `minTotal`**, bukan `total`.

**Tautan, tombol, dan drag.** Tautan yang menutupi kartu di `z-10`; kendali
(panah, filter) di `z-20` supaya bisa ditekan tanpa membuka halaman detail.
Daftar yang digulir juga di `z-20` — kalau ia di bawah tautan, gulirannya jalan
tapi setiap sentuhan ikut membuka halaman. Sebagai gantinya daftar itu punya
`onClick` sendiri ke halaman yang sama; tautan aslinya tetap ada untuk keyboard
dan pembaca layar. Drag dikunci `drag="x"` supaya tidak berebut dengan guliran
vertikal di dalam kartu.

### `/pc-prebuild/<id>` — detail

Galeri kiri (memakai `ProductGallery` milik halaman produk — komponen yang sama,
bukan salinan), panel performa kanan, isi paket grid dua kolom, bilah aksi
sticky di bawah.

- **Harga per komponen sengaja tidak ditampilkan.** Yang dijual adalah paketnya;
  harga satuan di tiap baris mengundang pelanggan menjumlahkan sendiri lalu
  menawar selisihnya, dan angka hasil penjumlahan itu bukan angka yang bisa
  dipenuhi CS.
- **Total di bilah aksi ikut pilihan tukar.** Ini penjumlahan harga satuan
  katalog yang dikirim server — bukan harga yang diturunkan dari rumus (§3,
  CLAUDE.md §2.7). Server tetap menghitung ulang seluruhnya saat memesan.
- "Ubah Rakitan" membawa pilihan yang sedang aktif ke `?pick=`, dan yang
  dicantumkan hanya barang yang **punya** pilihan tukar — barang tanpa cabang
  toh cuma punya satu kemungkinan.

### `toPrebuildView()` adalah pintu satu-satunya ke klien

`ResolvedPrebuildPreset` **tidak** dioper apa adanya ke komponen. `resolve.ts`
bertanda `server-only` dan bentuknya memuat hal yang tidak boleh menyeberang:
`performance` apa adanya (draf, hasil basi) dan `bottleneck` yang khusus admin.
`toPrebuildView()` di `features/pc-prebuild/lib/to-view.ts` yang memutuskan apa
yang lewat — satu tempat, bukan diulang di tiap halaman.

Ia juga yang **membuang pilihan yang produknya sudah hilang** dari katalog:
tombol pilihan yang menunjuk produk tidak ada hanya menghasilkan slot kosong di
wizard, dan `/build-pc` memang sudah melewatinya saat memuat preset — jadi
menampilkannya di sini berarti dua halaman bercerita berbeda. Barang yang
SELURUH pilihannya hilang tidak disembunyikan, ia ditandai.

### Urutan komponen

Processor → RAM → Penyimpanan → Graphics Card dipatok di depan; sisanya
mengikuti urutan langkah di `/admin/pc-builder`. Yang sudah ditarik ke atas
**tidak muncul lagi** di bawah. Paket yang tidak punya salah satunya (kantor
ber-grafis terintegrasi) cuma kehilangan barisnya — sisanya naik, bukan
menyisakan lubang.

Perannya ditebak `detectComponentRole()`, daftar kata kunci yang sama dengan
tombol admin dan endpoint AI (§9). Ikonnya dikunci ke **peran**, bukan ke nama
langkah — kalau ia mencocokkan namanya sendiri, "VGA" bisa dapat ikon kartu
grafis di kartu sementara analisisnya menganggapnya komponen lain.

### Masukkan keranjang: satu blok, bukan tujuh barang

Keputusan 28 Agustus 2026, menggantikan catatan "perlu keputusan lebih dulu"
yang sebelumnya ada di §10.

| Pertanyaan | Keputusan |
|---|---|
| Bentuk di keranjang | Satu blok bernama, komponen terdaftar di bawahnya tanpa harga satuan, **satu harga untuk keseluruhan** |
| Hapus | Menghapus **paketnya**, bukan komponennya satu per satu |
| Tambah paket yang sama | Jumlah **paket** jadi 2; kuantitas komponen ikut dikali dan tidak bisa diubah sendiri |
| Pilihan tukar berbeda | **Dua paket terpisah** — kunci bundle = id preset + kombinasi pilihan |
| Pesan ke CS | Satu nomor bernama + komponennya menjorok, tanpa harga satuan |
| Komponen hilang saat checkout | **Seluruh paket ditahan**, pelanggan yang memutuskan |

Bentuk penyimpanannya, alasan kenapa paket tidak punya jalur harga sendiri, dan
perubahan pada `CartItem.id` serta `prepareCheckoutWhatsApp` ada di
[`docs/05-data-fetching.md` §13](./05-data-fetching.md).

### `FpsMatrixChart` pindah ke `features/`

Dulu di `app/admin/(panel)/pc-prebuild/_components/`. Sekarang dipakai DUA
tempat — panel admin (dengan `onChange`, angkanya bisa disunting) dan halaman
paket (tanpa `onChange`, baca-saja) — jadi ia tinggal di
`features/pc-prebuild/components/`. Halaman pelanggan yang mengimpor dari dalam
`app/admin/` adalah jalur yang akan diputus orang berikutnya yang merapikan
panel.

Ambang warna FPS ikut keluar ke `lib/fps-tone.ts` karena kartu memakainya juga.
Kalau ambangnya disalin, paket yang sama bisa terlihat "hijau" di layar staff
dan "kuning" di layar pelanggan.
