# 19. Login Staff lewat HNS SSO

> Tahap 1 dikerjakan 15 November 2026. Staff bisa masuk ke ecommerce memakai akun
> **HNS SSO** (`https://auth.hnsitcenter.id`), yaitu akun yang sama dengan web
> Ticketing dan web Data. Login email + password lama **tetap berjalan** di samping
> SSO. Instruksi resmi server SSO **tidak disimpan di repo ini**. Unduh dari menu
> **Panduan Integrasi** di `https://auth.hnsitcenter.id`. Dokumen ini mencatat cara
> ecommerce memakainya dan keputusan yang berbeda dari saran bawaannya.

---

## 1. Siapa memegang apa

| Data | Tempatnya |
|---|---|
| Siapa orangnya, password, 2FA | **SSO** |
| Boleh masuk ecommerce atau tidak | **SSO** (whitelist per aplikasi) |
| Peran (owner/staff, peran dinamis), izin per halaman | **ecommerce**, tabel `users` + `roles` |
| Nama tampilan sales, quotation, log | **ecommerce** |

SSO tidak mengirim klaim peran sama sekali. Jadi tabel `users` tetap ada, dan setiap
orang yang datang dari SSO harus dipasangkan ke satu barisnya. Jembatannya
**`users.sso_sub`**.

**Pelanggan tidak pernah ada di SSO.** SSO HNS khusus staff. Pelanggan tetap masuk
dengan Google atau email + password seperti sebelumnya.

**SSO tidak dipakai untuk panggilan server-ke-server.** SSO hanya punya grant
`authorization_code` dan `refresh_token`, tanpa `client_credentials`, dan access
token-nya hanya sah untuk client yang memintanya. Integrasi antar-server (misalnya
Ticketing menarik quotation) butuh token tersendiri, bukan SSO.

---

## 2. Alur

### 2.1 Satu tombol Google untuk semua orang (16 November 2026)

**Halaman `/login` tidak punya tombol SSO.** Keputusan pemilik project: pintu masuk
staff tidak diumumkan ke publik. Label "khusus staff" memberi tahu orang luar di mana
harus mencoba-coba, sedangkan tombol yang tampak seperti cara masuk ketiga membuat
pelanggan mengkliknya lalu ditolak SSO.

Staff menekan tombol **"Masuk dengan Google"** yang sama dengan pelanggan.
Pembedanya ada di callback Google (`src/app/api/auth/google/callback/route.ts`):

```
/login → "Masuk dengan Google" → pilih akun Google
  → GET /api/auth/google/callback
      akun pelanggan / pendaftar baru → alur pelanggan seperti biasa (tidak ada panggilan ke SSO)
      akun STAFF → POST {SSO}/api/clients/access-check  (checkSsoAccess, batas 5 detik)
          true  → redirect /api/auth/sso/login?login_hint=<email> → alur SSO di bawah
          false → sesi admin langsung dari Google (MASA PERALIHAN)
          null  → sama dengan false, ditambah log peringatan (SSO tak terjangkau)
```

- **Hanya akun staff yang ditanyakan ke SSO.** Pelanggan tidak pernah ada di SSO, jadi
  menanyakannya hanya memperlambat login pelanggan tanpa mungkin mengubah hasilnya.
- **`login_hint`** mengisi kolom email di halaman SSO. Nilainya disaring
  `normalizeLoginHint()`, karena query string bisa diisi siapa pun. Fungsinya hanya
  pra-isi, bukan bukti identitas.
- **Staff yang akun SSO-nya tidak memakai Google** masuk dari **Portal SSO**
  (`auth.hnsitcenter.id` → HNS Ecommerce). Aplikasi ini tampil di Portal, dan Initiate
  Login URL-nya adalah `/api/auth/sso/login`.
- **Masa peralihan, keputusan pemilik project 16 Nov 2026.** Staff yang belum
  di-whitelist SSO (`false`) dan staff yang menekan Google saat SSO mati (`null`) tetap
  mendapat sesi admin langsung dari Google, seperti sebelum SSO ada. Alasannya
  operasional: sebagian staff belum diimpor ke SSO, dan SSO yang mati tidak boleh
  mengunci staff dari toko. Panduan SSO menyatakan staff seharusnya **hanya** masuk
  lewat SSO. Menutup jalur ini termasuk tahap 2 (§8), setelah semua staff ada di SSO.
- Sesi dari jalur Google langsung tetap 7 hari. Hanya sesi yang lahir lewat SSO yang
  12 jam (§4).

### 2.2 Alur SSO

```
GET /api/auth/sso/login[?login_hint=…]   (dari callback Google, Portal SSO, atau "Coba lagi")
      buat state + nonce + PKCE verifier → cookie hns_sso_flow (10 menit)
      → redirect ke auth.hnsitcenter.id/oauth/authorize
  → staff login di SSO (SSO cek whitelist)
  → GET /api/auth/sso/callback?code&state&iss
      error? → halaman galat
      state cocok dengan cookie? (konstan-waktu)
      iss === SSO_ISSUER? (RFC 9207)
      tukar code (client_secret_basic + code_verifier)
      verifikasi id_token: RS256 via JWKS, iss, aud, azp, exp, nonce
      cocokkan akun (§3)
      createSession(…, 12 jam) → landingPathFor(izin)
```

| Berkas | Isi |
|---|---|
| `src/lib/auth/sso.ts` | Konfigurasi, discovery (cache 5 menit), PKCE, penukaran code, verifikasi id_token |
| `src/lib/auth/sso-state.ts` | Cookie alur sementara + perbandingan `state` konstan-waktu |
| `src/lib/auth/sso-link.ts` | Pencocokan orang SSO → baris `users` |
| `src/app/api/auth/sso/login/route.ts` | Mulai login. URL ini juga "Initiate Login URL" di SSO |
| `src/app/api/auth/sso/callback/route.ts` | Callback |
| `src/app/api/auth/google/callback/route.ts` | Pengalihan staff ke SSO lewat `checkSsoAccess` (§2.1) |
| `src/app/login/page.tsx` | Sengaja TANPA tombol SSO (§2.1) |
| `src/app/login/error/page.tsx` | Pesan galat `sso_*` versi staff |

Memakai `jose` + `fetch`, polanya sama dengan login Google pelanggan
(`lib/auth/google.ts`). Tidak ada library klien OIDC tambahan.

**Token dari SSO tidak disimpan.** Token dipakai sekali untuk membuktikan siapa
orangnya, lalu ecommerce menerbitkan sesi admin miliknya sendiri. Seluruh
`requireAuth()`, RBAC, dan proxy tidak tahu, dan tidak perlu tahu, sesi itu lahir
lewat SSO.

**Semua alamat diambil dari env**, bukan dari `request.url`. Di balik proxy Hostinger,
alamat request terbaca sebagai alamat bind server (`0.0.0.0:3000`). Lihat catatan di
`/api/auth/google/route.ts`.

---

## 3. Pencocokan akun: penautan lewat email sekali, sesudahnya lewat `sub`

1. Cari `users.sso_sub = sub`. Ini jalur normal sesudah login pertama.
2. Kalau belum ada, cari `users.email = email`, **hanya akun non-pelanggan** yang
   `sso_sub`-nya masih kosong, lalu isi `sso_sub`.
3. Selain itu **ditolak**.

**Kenapa `sub`, bukan email.** Email bisa berpindah tangan di SSO. Contohnya sales A
keluar, lalu alamatnya diberikan ke sales B. Kalau pencocokan lewat email, B masuk
sebagai akun A, lengkap dengan peran, quotation, dan angka penjualannya. Dengan
`sub`, B punya UUID lain, menemukan akun A sudah tertaut ke `sub` lain, dan ditolak
(`sso_sub_conflict`).

**Tidak ada akun yang dibuat otomatis.** Ini berbeda dari saran bawaan panduan SSO, dan
alasannya ada di `users.role`, yang ber-default **`"owner"`**. Akun yang lahir sendiri
dari login SSO adalah akun yang perannya tidak pernah diputuskan siapa pun. Owner
menyiapkan akun staff dulu di **Manajemen User** (email yang sama persis dengan email
SSO, beserta perannya). Login SSO pertama yang menautkannya.

**Akun pelanggan tidak pernah ditautkan** (`sso_customer_account`), dan perannya tidak
diubah. Pengecualiannya master (`MASTER_ADMIN_EMAIL`), dengan alasan yang sama seperti
di `getCurrentUser`.

**Nama dan email lokal tidak disegarkan dari klaim SSO.** Nama bisa sudah dirapikan di
panel, dan email baru dari SSO bisa bertabrakan dengan unique index `users.email`
milik baris lain. Kalau dibutuhkan, ini keputusan tahap berikutnya.

---

## 4. Sesi 12 jam

Sesi admin dari SSO berumur **12 jam** (`SSO_SESSION_MAX_AGE_SECONDS`), sama dengan
batas absolut sesi SSO. Sesi dari login password tetap 7 hari.

Alasannya, back-channel logout belum dipasang (§8). Staff yang dinonaktifkan atau
dicabut aksesnya di SSO **tetap masuk ecommerce sampai sesinya habis**. Dengan 12 jam,
jendela itu paling lama satu hari kerja. Login ulang cukup satu klik selama sesi SSO-nya
masih hidup.

---

## 5. Pesan galat (`/login/error?reason=…`)

| `reason` | Arti | Siapa yang membereskan |
|---|---|---|
| `sso_not_configured` | Env SSO belum lengkap | Developer / hPanel |
| `sso_access_denied` | Belum di-whitelist, atau staff membatalkan | Admin SSO |
| `sso_not_provisioned` | Login SSO sukses, tapi tidak ada akun staff dengan email itu | Owner, di Manajemen User |
| `sso_customer_account` | Email SSO milik akun pelanggan | Owner (dipisahkan manual) |
| `sso_sub_conflict` | Email sudah tertaut ke orang SSO lain | Owner |
| `sso_state_invalid` | Cookie alur hilang/kedaluwarsa, `state`/`iss` salah | Coba lagi |
| `sso_network` | SSO tak terjangkau dari server | Tunggu / cek jaringan |
| `sso_token` | SSO menolak penukaran, atau id_token tidak sah | Lihat log server |

Detail teknisnya hanya ada di log server (awalan `[sso/callback]` dan `[sso/login]`),
tidak ditampilkan di layar.

---

## 6. Konfigurasi

Lima env, semuanya opsional, dan **harus terisi bersamaan** (docs/07 §2.13). Kalau
kosong atau hanya sebagian, tombolnya tidak tampil dan login password tetap jalan.
String kosong dibaca sebagai tidak diisi, jadi kolom kosong di hPanel tidak mematikan
situs.

**Setiap lingkungan punya client sendiri di SSO.** Jangan menyalin nilai client
Ticketing atau Data, karena SSO mencocokkan redirect URI persis per client. Pada 15 Nov
2026 `.env.local` sempat berisi nilai client Ticketing.

| Field di SSO | Dev (`HNS Ecommerce (Dev)`) | Produksi (`HNS Ecommerce`) |
|---|---|---|
| Jenis client | Confidential | Confidential |
| Homepage | `http://localhost:3000` | `https://hnsitcenter.id` |
| Initiate Login URL | `http://localhost:3000/api/auth/sso/login` | `https://hnsitcenter.id/api/auth/sso/login` |
| Redirect URI | `http://localhost:3000/api/auth/sso/callback` | `https://hnsitcenter.id/api/auth/sso/callback` |
| Post-logout Redirect | `http://localhost:3000/login` | `https://hnsitcenter.id/login` |
| Back-channel Logout | (kosong; SSO tak bisa menjangkau localhost) | (kosong sampai tahap 2) |
| Scope | openid, profile, email | openid, profile, email |
| Siapa yang boleh login | Hanya yang diberi akses | Hanya yang diberi akses |

**Ecommerce di hPanel, SSO di VPS: tidak masalah.** Arah panggilannya hanya browser ke
keduanya, dan server ecommerce ke `auth.hnsitcenter.id` (HTTPS keluar, pola yang sama
dengan panggilan ke web Data). SSO tidak perlu menjangkau server ecommerce sampai
back-channel dipasang.

---

## 7. Uji

```bash
npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-sso.mts
```

Skrip ini menjalankan SSO **tiruan** di 127.0.0.1 dengan kunci RSA buatan sendiri, lalu
menguji fungsi dan route asli. Hasilnya 73/73 lolos pada 16 Nov 2026. Yang diuji:

- Parameter authorize, PKCE S256, `login_hint` (diteruskan, dinormalisasi, dan dibuang
  kalau bukan email), serta atribut cookie alur.
- `checkSsoAccess`: `true`, `false`, dan `null` untuk galat 500, jawaban berbentuk aneh,
  secret salah, SSO tak terjangkau, serta SSO lambat lebih dari 5 detik (tidak menahan
  login).
- Penolakan untuk `state` salah, `iss` hilang atau salah, `nonce`, `aud`, `azp`,
  kedaluwarsa, kunci asing, verifier salah, secret salah, `invalid_grant`, dan SSO
  tak terjangkau.
- Pencocokan akun di DB lokal memakai akun `ZZ TEST`: tidak terdaftar, akun pelanggan,
  penautan pertama, email berubah, alamat berpindah tangan, staff yang diturunkan.
- Sesi 12 jam.
- Env kosong yang tidak mematikan aplikasi.

Skrip menolak jalan kalau `DATABASE_URL` bukan localhost.

**Uji lokal dengan SSO sungguhan (16 Nov 2026), lolos.** Memakai client
"HNS Ecommerce (Dev)" dan DB lokal Docker:

| Skenario | Hasil |
|---|---|
| Login pertama | Akun ditautkan lewat email, lalu mendarat di `/admin` |
| Login berikutnya | Akun ditemukan lewat `sso_sub`, tanpa penautan ulang |
| Email belum terdaftar sebagai staff | `sso_not_provisioned` |
| Email milik akun pelanggan | `sso_customer_account`, dan `sso_sub` tetap kosong |
| Email sudah tertaut ke orang SSO lain | `sso_sub_conflict`, dan tautan lama tidak tertimpa |

Tiga skenario penolakan dipancing dengan mengubah sementara baris akun penguji di DB
lokal, lalu barisnya dipulihkan.

**Jebakan di lokal:** route baru di `/api/auth/sso/*` bisa membalas **404** di `next dev`
karena cache Turbopack (`.next/dev`) masih memegang daftar route lama. Hentikan server
dev, hapus `.next/dev`, lalu jalankan ulang. Build produksi tidak terdampak, karena
selalu dibangun dari nol.

**Produksi, 16 Nov 2026:** login lewat tombol SSO (versi `40aa02a`) berhasil sampai
`/admin`.

**Satu tombol Google (§2.1), uji lokal 16 Nov 2026:** staff `developer.hns2` menekan
Google, lalu `/api/auth/sso/login?login_hint=…`, lalu callback SSO, lalu `/admin`.
Akun Google pelanggan tetap masuk lewat alur pelanggan (lengkapi profil).

**Belum teruji:** satu tombol Google di produksi, dan tampilan di layar HP (375px).

---

## 8. Belum dikerjakan (tahap berikutnya)

- **Logout yang ikut mengakhiri sesi SSO** (`/oauth/logout`). Logout sekarang hanya
  mengakhiri sesi ecommerce.
- **Back-channel logout.** Sesi admin di sini stateless, jadi butuh tabel `sso_sessions`
  (sid → user) atau pencabutan lewat `passwordChangedAt` (memutus semua perangkat).
- **Mengakhiri masa peralihan (§2.1).** Setelah semua staff ada di SSO: jawaban
  `false`/`null` untuk akun staff di callback Google tidak lagi memberi sesi langsung.
- **Mematikan login password untuk staff**, dengan satu akun darurat yang tetap memakai
  password lokal. Form password di `/login` sampai sekarang masih menerima akun staff.
- Form identifier-first (ketik email dulu) **tidak dipakai**. Ia digantikan satu tombol
  Google (§2.1), atas pilihan pemilik project.
- **Password staff tidak bisa diimpor ke SSO.** Hash di sini scrypt, sedangkan SSO hanya
  menerima bcrypt. Staff masuk SSO lewat Google atau password yang direset admin SSO.
