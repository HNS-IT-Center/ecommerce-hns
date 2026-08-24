# PC Prebuild — Paket Rakitan Siap Pakai

> Baca ini sebelum menyentuh apa pun di `/admin/pc-prebuild`, `/pc-prebuild`, atau
> pemuatan preset di `/build-pc`.
>
> Dibangun 19–20 Agustus 2026. Dokumen ini memuat **keputusan beserta alasannya**,
> karena beberapa di antaranya terlihat seperti detail sepele padahal justru
> menahan kerusakan yang sudah pernah terjadi di tempat lain di repo ini.

---

## 1. Apa ini, dan bukan apa

Paket rakitan yang disusun staff, lalu **dimuat ke wizard PC Builder yang sudah
ada** dan boleh diubah pelanggan sebelum memesan.

Ia **bukan** produk baru di katalog. Tidak ada SKU "Gaming 10 Juta"; yang ada
adalah daftar komponen yang menunjuk produk-produk katalog yang sudah ada.

Alurnya:

```
/admin/pc-prebuild        staff menyusun paket, menyalakan sakelar
        ↓
/pc-prebuild              kartu paket (foto utama, 4 komponen, harga)
        ↓  "Lihat detail paket"
/pc-prebuild/<id>         spesifikasi lengkap, galeri, pilihan varian
        ├─ "Pesan lewat WhatsApp"   → prepareBuildWhatsApp (harga dihitung ulang di server)
        ├─ "Simpan rakitan ini"     → SavedPcBuild, ikut mesin pemberitahuan perubahan harga
        └─ "Ubah di PC Builder"     → /build-pc?preset=<id>&pick=…
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
    images: string[],          // URL R2; yang pertama = foto utama
    order: number,
    slots: [{
      stepId: string,          // menunjuk step di PC_BUILDER_CONFIG
      options: [{ productId, quantity, label? }]
    }],
    performance?: { … }        // hasil analisis AI — opsional, lihat §9
  }]
}
```

Daftar game untuk grid FPS TIDAK tinggal di sini melainkan di baris `settings`
sendiri berkunci `PC_PREBUILD_GAMES` — ia satu daftar untuk semua paket, dan
menyimpannya bersama paket berarti menyunting satu nama game ikut menuliskan
ulang seluruh konfigurasi paket. Pola yang sama dipakai `PC_BUILDER_DISPLAY`
terhadap `PC_BUILDER_CONFIG`.

### Dua bentuk masuk, satu bentuk keluar

`parsePrebuildConfig()` menerima bentuk lama **dan** baru, tapi selalu
mengeluarkan bentuk baru:

| Lama | Baru |
|---|---|
| `items: [{ stepId, productId, quantity }]` | `slots: [{ stepId, options: [...] }]` |
| `image: "…"` (satu URL) | `images: ["…"]` |

`savePcPrebuildConfig()` menjalankan parser itu **sebelum menulis**, jadi setiap
penyimpanan menormalkan datanya. Tanpa itu, dua bentuk akan hidup berdampingan di
kolom JSON selamanya dan setiap pembaca berikutnya harus tahu keduanya.

**Kalau menambah bentuk lagi nanti, ikuti pola yang sama.** Jangan menulis skrip
migrasi untuk kolom JSON — parser yang toleran lebih murah dan tidak bisa gagal
separuh jalan.

---

## 3. Harga — baca ini sebelum mengubah apa pun

**Preset tidak pernah menyimpan harga.** Isinya hanya `productId` dan `quantity`.

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
| Pilihan per slot | 3 | Tiga slot × tiga pilihan sudah 27 kombinasi harga di satu halaman |
| Slot bercabang per paket | 3 | Lebih dari itu halaman detail berubah jadi konfigurator — dan untuk itu sudah ada PC Builder |
| Foto per paket | 4 | Satu utama + tiga pendamping: depan, dalam casing, tata kabel, belakang |

Batasnya ditegakkan **di parser**, bukan cuma di UI. Data yang masuk lewat jalur
mana pun tetap patuh. Slot bercabang yang melebihi batas **dikunci ke bawaannya**,
bukan dibuang — paketnya tetap utuh, cuma berhenti bercabang.

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

## 7. Tiga jebakan teknis yang sudah menggigit

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

**3. `product.id` internal, BUKAN `wooId`.**
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
/admin/pc-prebuild  →  "Hitung dengan AI"  →  ConfirmDialog
        ↓
POST /api/admin/pc-prebuild-performance      (requireAuth, openai/gpt-oss-120b)
        ↓
hasil masuk sebagai DRAF di state panel      (published: false)
        ↓  staff menyunting angka bila perlu, lalu menyalakan "Tampilkan ke pelanggan"
"Simpan"  →  tersimpan di dalam presetnya    (PC_PREBUILD_CONFIG)
```

### Katalognya TERTUTUP — AI memilih, tidak mengarang

Use case (7), tingkatan resolusi (5), setelan grafis (4), dan prioritas upgrade
(3) adalah daftar tetap di [`lib/pc-prebuild/performance.ts`](../src/lib/pc-prebuild/performance.ts).
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
  hanya sebagai konteks kelas paket. Selisih harga upgrade yang dikarang model
  persis jenis angka yang dilarang [CLAUDE.md §2.7](../CLAUDE.md).
- Estimasi FPS memakai satu patokan tetap: **1080p**, dengan setelan grafis
  disebut per baris. Patokan yang berpindah-pindah membuat angka antar paket
  tidak bisa dibandingkan.

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

Tab kedua di `/admin/pc-prebuild` (bukan rute baru, bukan entri sidebar). Maksimal
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
memakan `max_tokens`, jadi 2.500 dipilih supaya keluaran (terukur 856 token pada
delapan game) tetap muat walau daftarnya penuh dua belas game. Rinciannya di
[`docs/05-data-fetching.md` §10.3](./05-data-fetching.md).

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

- **Masukkan keranjang** dari halaman paket. Perlu keputusan lebih dulu: paket
  berisi 6–8 produk, dan memasukkannya sebagai item terpisah membuat pelanggan
  bisa menghapus satu lalu merusak rakitannya tanpa sadar.
- **Catatan garansi & estimasi waktu rakit** di halaman detail. Isinya kebijakan
  HNS, bukan sesuatu yang boleh dikarang.
- **Kategori paket** (gaming / kantor / editing) kalau jumlah paketnya bertambah
  banyak.
- Halaman ini masih **daftar paket**, bukan halaman jualan bergaya editorial.
  Mengubah ke sana butuh foto rakitan yang bagus dan naskah — bukan pekerjaan CSS.
