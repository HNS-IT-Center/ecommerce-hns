# Akun Pelanggan lewat Google — Persiapan Google Cloud

Dokumen ini menyiapkan kredensial Google OAuth untuk **akun pelanggan**
(menyimpan rakitan PC, melihat riwayat pesanan). Semuanya dikerjakan di konsol
Google Cloud; tidak ada kode yang perlu ditulis untuk menyelesaikan langkah di
sini.

> **Belum ada kode akun pelanggan di repo ini saat dokumen ditulis (7 Agustus
> 2026).** Dokumen ini menyiapkan kredensialnya lebih dulu, karena proses
> verifikasi Google memakan waktu berhari-hari dan sebaiknya sudah jalan sebelum
> kodenya dibutuhkan.

---

## 1. Apa yang sudah ada, dan apa yang TIDAK boleh disentuh

Repo ini sudah punya autentikasi — tapi itu **akun admin**, dan Google OAuth
tidak boleh mencampurinya.

| | Akun admin (sudah ada) | Akun pelanggan (yang akan dibangun) |
|---|---|---|
| Tabel | `users` (`prisma/schema.prisma`) | tabel baru, belum dibuat |
| Cara masuk | username/email + password scrypt | Google |
| Sesi | cookie bertanda tangan sendiri (`src/lib/auth/session.ts`) | belum diputuskan |
| Halaman | `/admin/login` | `/login` (sekarang mengarah ke WhatsApp) |

**Jangan tambahkan kolom `googleId` ke tabel `users`.** Tabel itu memberi akses
ke panel admin — seluruh katalog, harga, dan data toko. Menyambungkan login
Google ke sana berarti siapa pun yang berhasil membuat akun Google atas email
seorang staf bisa masuk ke panel. Akun pelanggan harus punya tabelnya sendiri.

`AUTH_SECRET` yang sudah ada di `.env.local` milik sesi admin. Kredensial Google
di bawah adalah variabel terpisah dan tidak menggantikannya.

---

## 2. Buat project di Google Cloud

1. Buka [console.cloud.google.com](https://console.cloud.google.com).
2. Login dengan akun Google **milik HNS**, bukan akun pribadi siapa pun.
   Kredensial ini akan hidup selama situsnya hidup; kalau terikat akun pribadi,
   ia hilang saat orangnya pergi.
3. Klik pemilih project di bilah atas → **New Project**.
   - **Project name:** `hns-itcenter-web`
   - **Organization / Location:** biarkan default kalau tidak memakai Google
     Workspace.
4. **Create**, lalu tunggu sampai project terpilih di bilah atas.

---

## 3. Isi OAuth consent screen

Ini yang dilihat pelanggan saat menekan "Masuk dengan Google", jadi isinya
menentukan apakah mereka percaya.

Buka **APIs & Services → OAuth consent screen**.

### User Type

Pilih **External**. "Internal" hanya tersedia untuk Google Workspace dan hanya
mengizinkan akun dalam organisasi itu — pelanggan HNS memakai Gmail pribadi.

### App information

| Kolom | Isi |
|---|---|
| App name | `HNS IT Center` |
| User support email | email HNS yang benar-benar dibaca |
| App logo | logo HNS, PNG/JPG, maksimum 1 MB, rasio 1:1 |

> **Mengunggah logo memicu verifikasi merek oleh Google** yang bisa memakan
> beberapa hari kerja. Kalau ingin cepat jalan, kosongkan dulu logonya —
> layar izin tetap berfungsi, hanya menampilkan nama tanpa gambar. Logo bisa
> ditambahkan belakangan.

### App domain

| Kolom | Isi |
|---|---|
| Application home page | `https://hnsitcenter.id` |
| Application privacy policy link | halaman kebijakan privasi HNS |
| Application terms of service link | halaman syarat & ketentuan |

Google **menolak** pengajuan verifikasi tanpa tautan kebijakan privasi yang
benar-benar bisa dibuka. Kalau halamannya belum ada, ia harus dibuat lebih dulu —
ini bukan formalitas yang bisa dilewati.

### Authorized domains

Tambahkan `hnsitcenter.id` (tanpa `https://`, tanpa `www`).

Domain harus sudah terbukti milik HNS lewat Google Search Console. Kalau belum,
lakukan verifikasi domain di sana lebih dulu.

---

## 4. Pilih scope seminimal mungkin

**Add or Remove Scopes**, lalu centang **hanya** tiga ini:

| Scope | Untuk apa |
|---|---|
| `openid` | menandakan alur OpenID Connect |
| `.../auth/userinfo.email` | mengenali pelanggan yang kembali |
| `.../auth/userinfo.profile` | nama & foto untuk ditampilkan |

Ketiganya termasuk **non-sensitive**, sehingga aplikasi bisa langsung dipakai
tanpa menunggu audit keamanan Google.

**Jangan menambah scope lain.** Meminta akses Gmail, Drive, atau Kontak akan
memindahkan aplikasi ini ke kategori *sensitive* atau *restricted*, yang
mewajibkan tinjauan keamanan berbayar dan berbulan-bulan. Tidak ada satu pun
fitur HNS yang membutuhkannya.

---

## 5. Buat OAuth Client ID

**APIs & Services → Credentials → Create Credentials → OAuth client ID**.

- **Application type:** Web application
- **Name:** `HNS Web` (hanya label internal)

### Authorized JavaScript origins

```
http://localhost:3000
https://hnsitcenter.id
```

### Authorized redirect URIs

```
http://localhost:3000/api/auth/google/callback
https://hnsitcenter.id/api/auth/google/callback
```

Tiga hal yang sering membuat alur ini gagal:

- **Harus sama persis.** Beda satu garis miring di ujung, atau `http` versus
  `https`, ditolak dengan `redirect_uri_mismatch`.
- **`www` adalah host yang berbeda.** Kalau situs juga dilayani di
  `www.hnsitcenter.id`, tambahkan barisnya sendiri.
- **Path-nya `/api/auth/google/callback`**, bukan `/api/auth/callback/google`
  (konvensi Auth.js). Project ini tidak memakai Auth.js — lihat §8.

Setelah **Create**, Google menampilkan **Client ID** dan **Client Secret**.
Secret hanya bisa dilihat sekali dengan nyaman; salin sekarang.

---

## 6. Simpan kredensialnya

Tambahkan ke `.env.local` (berkas ini **tidak** masuk git):

```bash
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
```

Lalu tambahkan **nama variabelnya saja, tanpa nilai** ke `.env.example`, dan
catat di [`docs/07-environment-variables.md`](./07-environment-variables.md) —
keduanya wajib menurut checklist di `CLAUDE.md` §5.

**Client secret tidak boleh diawali `NEXT_PUBLIC_`.** Awalan itu menyuntikkan
nilainya ke bundel JavaScript yang dikirim ke setiap pengunjung; secret-nya akan
terbaca siapa saja lewat devtools, dan siapa pun bisa menyamar sebagai situs HNS
di hadapan Google.

Kalau secret pernah bocor — ter-commit, terkirim di chat, tertempel di tiket —
cabut lewat **Credentials → nama client → Reset Secret**. Mengganti nilai di
`.env.local` saja tidak mencabut yang lama.

---

## 7. Publikasikan aplikasinya

Selama status masih **Testing**, hanya akun yang terdaftar di **Test users**
yang bisa masuk; pelanggan lain menerima galat `access_denied`.

- **Untuk uji coba:** tambahkan email penguji di **Test users** (maksimum 100).
- **Untuk pelanggan sungguhan:** **OAuth consent screen → Publish App**.

Dengan hanya tiga scope non-sensitive di atas, publikasi berlaku segera tanpa
menunggu tinjauan Google. Yang memicu tinjauan panjang adalah logo bermerek
(§3) dan scope sensitif (§4).

---

## 8. Keputusan rancangan (sudah final, 7 Agustus 2026)

Dicatat di sini supaya siapa pun yang mengubah konfigurasi Google Cloud tahu
apa yang bergantung padanya.

**Tanpa Auth.js/NextAuth.** Alurnya ditulis sendiri mengikuti pola
`src/lib/auth/session.ts` yang sudah dipakai sesi admin, TAPI seluruh
kriptografi dan pemeriksaan klaim diserahkan ke **`jose`** (MIT, nol
dependensi, Web Crypto sehingga jalan di Edge).

Alasannya: bagian yang paling mudah salah bukan alurnya, melainkan verifikasi
`id_token` — mengambil JWKS Google, mencocokkan `kid`, dan menangani **rotasi
kunci**. Kunci Google berganti berkala; implementasi yang meng-cache JWKS tanpa
penanganan rotasi akan berjalan normal berminggu-minggu lalu mendadak menolak
semua login. `jose` menanganinya lewat `createRemoteJWKSet` dengan
`cooldownDuration`/`cacheMaxAge`, dan `JWKSNoMatchingKey` sebagai pemicu
pengambilan ulang.

Tim ini dua orang tanpa peninjau keamanan khusus. Kode kripto yang tidak pernah
ditinjau siapa pun tidak sebanding dengan menghemat satu dependensi.

| Keputusan | Nilai |
|---|---|
| Tabel | `customers`, **terpisah** dari `users` (yang tetap khusus admin) |
| Kunci identitas | `googleSub` unik — **bukan email**, karena email bisa berubah dan akun tidak boleh hilang karenanya |
| Yang disimpan | `googleSub`, `email`, `name`. Titik. |
| Foto profil | **TIDAK disimpan.** Halaman akun tidak memakainya; data pribadi paling aman adalah yang tidak pernah disimpan |
| Token akses & refresh | **TIDAK disimpan sama sekali.** Dipakai sekali saat login, lalu dibuang |
| Sesi | Token bertanda tangan di cookie `hns_customer_session` — nama berbeda dari `hns_admin_session` supaya tidak pernah saling menimpa |
| Pencabutan sesi | Kolom `sessionsRevokedAt`; token yang terbit sebelum waktu itu dianggap mati |
| Hapus akun | **Hard delete**, dengan `onDelete: Cascade` ke rakitan tersimpan, ditulis di migrasi pertama — bukan ditambahkan belakangan |
| Halaman terproteksi | Hanya `/akun/:path*`. Browsing, PC builder, keranjang, dan checkout WhatsApp tetap terbuka tanpa akun |

**Login tidak boleh mengubah harga.** Lihat `CLAUDE.md` §2.7 — tidak ada harga
member, tidak ada diskon khusus akun. Status login tidak pernah masuk ke jalur
perhitungan harga.

Migrasi tabelnya mengikuti [`docs/08-database-migrations.md`](./08-database-migrations.md);
ingat `prisma migrate dev` dilarang di repo ini.

---

## 9. Perilaku yang wajib ada saat implementasi

Tiga hal ini bukan urusan Google Cloud, tapi ditulis di sini karena mudah
terlewat sampai ada yang mengeluh.

### 9.1 Login gagal harus punya halaman sendiri

Alur OAuth punya banyak cara gagal yang bukan salah pelanggan: Google sedang
bermasalah, tab ditutup di tengah jalan, izin ditolak, `state` kedaluwarsa
karena formulir dibiarkan terbuka terlalu lama, atau `redirect_uri_mismatch`
karena konfigurasi Console salah.

Semua bermuara ke satu halaman yang **menjelaskan dan menawarkan jalan lain**,
bukan halaman kosong atau redirect diam-diam ke beranda:

| Sebab | Yang dilihat pelanggan |
|---|---|
| `error=access_denied` (menolak izin) | "Anda membatalkan proses masuk." + tombol coba lagi |
| `state` tidak cocok / kedaluwarsa | "Sesi masuk kedaluwarsa. Coba lagi." |
| Google tidak bisa dihubungi | "Gagal menghubungi Google. Coba beberapa saat lagi." |
| Sebab lain | Pesan umum, tanpa detail teknis |

Setiap keadaan **wajib** menyertakan jalan keluar yang tidak butuh akun: tombol
WhatsApp dan tautan kembali ke halaman sebelumnya. Akun hanya menambah
kemampuan menyimpan rakitan — kegagalan login tidak boleh menutup jalan
memesan.

Detail teknis (`error_description` dari Google) masuk log server, **bukan** ke
layar pelanggan.

### 9.2 Endpoint callback wajib punya rate limit

`/api/auth/google/callback` bersifat publik dan **menulis ke database** (membuat
baris `customers` saat pelanggan baru pertama kali masuk). Ketentuannya sama
dengan endpoint kirim publik lain di project ini: batasi per IP, dan jangan
biarkan permintaan gagal berulang menjadi jalan membanjiri tabel.

Permintaan yang ditolak rate limit diarahkan ke halaman error §9.1 dengan pesan
"Terlalu banyak percobaan. Coba beberapa menit lagi."

### 9.3 Pelanggan harus kembali ke tempat ia berangkat

Kalau seseorang menekan "Simpan rakitan" di `/build-pc`, lalu login, ia harus
kembali **ke rakitannya** — bukan ke beranda dengan rakitan yang hilang.

Tujuan disimpan di dalam parameter `state` (yang memang sudah wajib ada untuk
mencegah CSRF), bukan di query string terpisah yang bisa diubah siapa saja.

**Tujuannya wajib divalidasi sebagai path internal.** Aturannya:

- harus diawali `/`
- **tidak boleh** diawali `//` maupun `/\` — keduanya dibaca peramban sebagai
  URL protokol-relatif menuju host lain
- tidak boleh memuat `://`
- kalau tidak lolos, jatuh ke `/akun` tanpa pesan galat

Tanpa validasi ini, tautan `?next=https://situs-penipu.example` menjadikan
domain HNS sebagai batu loncatan phishing yang tampak tepercaya — pelanggan
melihat alamat hnsitcenter.id, lalu mendarat di tempat lain.

---

## Ringkasan langkah

- [ ] Project `hns-itcenter-web` dibuat dengan akun Google milik HNS
- [ ] Consent screen: External, nama & email dukungan terisi
- [ ] Halaman kebijakan privasi & syarat-ketentuan ada dan bisa dibuka
- [ ] `hnsitcenter.id` terdaftar di Authorized domains dan terverifikasi
- [ ] Scope hanya `openid`, `userinfo.email`, `userinfo.profile`
- [ ] OAuth Client ID dibuat, redirect URI localhost + produksi terdaftar
- [ ] `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` di `.env.local`
- [ ] Nama variabel ditambahkan ke `.env.example` dan `docs/07-environment-variables.md`
- [ ] Aplikasi di-publish (atau penguji ditambahkan ke Test users)
