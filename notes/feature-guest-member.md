# Catatan Desain — Fitur Guest vs Member

> File ini mencatat progress desain fitur sistem role Guest & Member.
> Update file ini setiap kali ada keputusan baru atau fase selesai.

---

## Status Keseluruhan

| Fase | Nama | Status |
|---|---|---|
| Fase 1 | Business Analysis | ✅ Selesai |
| Fase 2 | Feature Planning | ✅ Selesai |
| Fase 3 | Sitemap / Info Architecture | ✅ Selesai |
| Fase 4 | User Flow | ✅ Selesai |
| Fase 5 | Page Planning | ✅ Selesai |
| Fase 6 | Component Planning | 🔲 Belum dimulai |
| Fase 7 | Wireframe | 🔲 Belum dimulai |
| Fase 8 | UI Design | 🔲 Belum dimulai |

---

## Fase 1 — Business Analysis ✅

**User Goal:**
- Guest → lihat harga menarik, ada insentif untuk beli atau register
- Member → merasa dihargai karena dapat keuntungan eksklusif

**Business Goal:**
- Bangun database customer (dorong guest → register jadi member)
- Tingkatkan repeat purchase dari member
- Tingkatkan konversi ke WhatsApp order dengan insentif harga

**Problem Statement:**
Tidak ada pembeda pengalaman guest vs member → tidak ada alasan untuk register → HNS tidak punya data customer untuk remarketing & loyalitas.

**Success Metric:**
- Jumlah registrasi member meningkat setelah fitur live
- Member melakukan lebih banyak repeat order vs guest
- CTR tombol "Login untuk harga member" di product page

### Konfirmasi Fase 1
| Item | Status | Keputusan |
|---|---|---|
| Checkout method Fase 1 | ✅ Dikonfirmasi | Via WhatsApp dulu |
| Jumlah level role | ✅ Dikonfirmasi | 2 level: Guest & Member |

---

## Fase 2 — Feature Planning ✅

**P0 — Wajib ada saat launch:**
- Guest melihat harga normal (termasuk sale price dari WooCommerce)
- Member melihat harga dengan potongan khusus member di produk tertentu
- Badge **"Harga Member"** di produk yang punya diskon member
- CTA di product page untuk guest: *"Login untuk dapat harga lebih hemat"*
- Halaman login & register dengan value proposition jelas soal keuntungan member

**P1 — Menyusul iterasi berikutnya:**
- Tampilkan berapa rupiah/persen yang bisa dihemat jika guest login
- Filter di shop page: "Tampilkan produk diskon member"
- Notifikasi ke member saat ada produk baru yang dapat diskon member

**P2 — Jangka panjang:**
- Member tier (Regular → VIP)
- History diskon yang pernah didapat member
- Diskon ulang tahun / reward poin

### Konfirmasi Fase 2
| Item | Status | Keputusan |
|---|---|---|
| Diskon member berbasis apa (per-produk / per-kategori / flat) | ⏳ Ditunda | Diputuskan nanti setelah desain selesai |

---

## Fase 3 — Sitemap / Info Architecture ✅

**Halaman BARU:**
```
/login          ← Form login member
/register       ← Form registrasi member baru
/account        ← Dashboard member (profil, riwayat order WA)
```

**Halaman EXISTING yang berubah:**
```
/shop               ← Badge "Harga Member" di product card
/product/[slug]     ← Harga member + CTA login untuk guest
/category/[slug]    ← Badge "Harga Member" di product card
```

### Konfirmasi Fase 3
| Item | Status | Keputusan |
|---|---|---|
| Daftar halaman baru & yang berubah | ✅ Dikonfirmasi | Sesuai di atas |

---

## Fase 4 — User Flow ✅

### Flow 1 — Guest melihat produk dengan diskon member
```
Guest buka /product/[slug]
    │
    ▼
Lihat harga normal (sale price WooCommerce jika ada)
    │
    ▼
Ada badge "Harga Member: Rp XX.XXX"
    │
    ▼
Ada CTA kecil: "Login untuk dapat harga ini"
    │
    ├── Klik CTA → /login
    │       ├── Sudah punya akun → login → kembali ke produk → harga member tampil
    │       └── Belum punya akun → /register → selesai → kembali ke produk
    │
    └── Tidak klik → tetap bisa order via WhatsApp dengan harga normal
```

### Flow 2 — Member yang sudah login
```
Member buka /product/[slug]
    │
    ▼
Langsung lihat harga member (tidak ada blur/CTA)
    │
    ▼
Badge kecil "Harga Member" sebagai konfirmasi visual
    │
    ▼
Tombol WhatsApp order → pesan pre-filled dengan harga member
```

### Flow 3 — Register jadi Member
```
Guest klik "Daftar" / CTA dari product page
    │
    ▼
/register → isi: nama, email, password, nomor HP
    │
    ▼
Submit → akun dibuat via WooCommerce Customer API
    │
    ▼
Auto login → redirect ke halaman sebelumnya (atau /account)
    │
    ▼
Langsung dapat akses harga member
```

### Konfirmasi Fase 4
| Item | Status | Keputusan |
|---|---|---|
| Sistem autentikasi member | ✅ Dikonfirmasi | Opsi A: WooCommerce Customer API |
| Admin WooCommerce terpisah dari role user frontend | ✅ Dikonfirmasi | Ya, admin = internal WooCommerce, tidak masuk role frontend |
| Aturan diskon dikelola di mana | ✅ Dikonfirmasi | Di Next.js (bukan WooCommerce plugin) |

---

## Fase 5 — Page Planning ✅

### `/login`
| Item | Detail |
|---|---|
| **Purpose** | Member masuk ke akun untuk dapat akses harga member |
| **Target user** | Guest yang sudah punya akun, atau guest yang baru klik CTA dari product page |
| **Business goal** | Konversi guest → active session → akses harga member → lebih mungkin order |
| **CTA utama** | Submit form login |
| **SEO** | `noindex` |

**Required components:**
- `LoginForm` — input email + password + tombol submit
- Link ke `/register` — *"Belum punya akun? Daftar sekarang"*
- Value proposition singkat — *"Login untuk dapat harga member eksklusif"*

**Optional (P1):** "Lupa password?" — reset via email

**Required data:**
- `POST` ke WooCommerce Customer auth endpoint
- `redirectUrl` — redirect balik ke halaman asal setelah login

---

### `/register`
| Item | Detail |
|---|---|
| **Purpose** | Calon member buat akun baru |
| **Target user** | Guest yang tertarik harga member, pertama kali ke HNS |
| **Business goal** | Bangun database customer untuk remarketing & loyalitas |
| **CTA utama** | Daftar → langsung dapat akses harga member |
| **SEO** | `noindex` |

**Required components:**
- `RegisterForm` — nama lengkap, email, password, nomor HP
- Value prop singkat — *"Daftar gratis. Dapat harga lebih hemat sekarang."*
- Link ke `/login` — *"Sudah punya akun? Login"*

**Optional (P1):** Checkbox opt-in promo via WhatsApp

**Required data:**
- `POST` ke WooCommerce Customer API — create customer
- Auto login setelah register berhasil → redirect ke halaman asal atau `/account`

---

### `/product/[slug]` — Perubahan
**Kondisi Guest:**
- Harga normal WooCommerce tetap tampil
- Blok "Harga Member" — harga dengan ikon gembok / sedikit di-blur
- CTA: *"Login untuk dapat harga ini"*

**Kondisi Member:**
- Harga member langsung tampil, tidak ada gembok/CTA login
- Badge kecil "Harga Member" sebagai konfirmasi visual
- Pesan WA pre-filled menggunakan harga member

**Required components (baru/modifikasi):**
- `MemberPriceBadge` — badge label harga member
- `LoginCTA` — blok CTA login untuk guest (muncul kondisional)
- `PriceTag` — modifikasi untuk 2 kondisi (guest vs member price)

**Required data:**
- Auth status (guest / member) dari session/cookie
- Member price produk — ⏳ *sumber data ditentukan saat aturan diskon diputuskan*

---

### `/account`
| Item | Detail |
|---|---|
| **Purpose** | Dashboard member — lihat & kelola profil |
| **Target user** | Member yang sudah login |
| **Business goal** | Engagement & kepercayaan member |
| **CTA utama** | Edit profil, Lanjut belanja, Logout |
| **SEO** | `noindex` |

**Required components (Fase 1):**
- Info profil — nama, email, nomor HP + tombol edit
- Tombol logout
- Link balik ke toko — *"Lanjut belanja →"*

**Optional (P1):** Riwayat order, ubah password, wishlist

**Required data:**
- `GET` WooCommerce Customer API — data profil member
- WooCommerce Orders — ⏳ *hanya tampil jika CS input order WA manual ke WooCommerce*

### Konfirmasi Fase 5
| Item | Status | Keputusan |
|---|---|---|
| Daftar halaman & komponen yang terdampak | ✅ Dikonfirmasi | Sesuai di atas |
| Riwayat order di `/account` | ⏳ Perlu konfirmasi | Apakah CS input order WA manual ke WooCommerce? |
| Field wajib di form register | ⏳ Perlu konfirmasi | Nama, email, password, nomor HP — ada tambahan? |

---

## Fase 6 — Component Planning 🔲

> Belum dimulai.

**Komponen baru yang kemungkinan dibutuhkan:**
- `MemberPriceBadge` — badge harga member
- `LoginCTA` — CTA untuk guest di product page
- `LoginForm` — form login
- `RegisterForm` — form register
- `AccountDashboard` — halaman akun member

---

## Fase 7 — Wireframe 🔲

> Belum dimulai.

---

## Fase 8 — UI Design 🔲

> Belum dimulai.

---

## Referensi Desain

**Aftershock PC (https://aftershockpc.com.au/)**

Yang diambil untuk HNS:
- Trust indicator section (lokasi toko fisik, testimoni, logo brand resmi yang dijual)
- Badge system per produk — icon + teks (contoh: "Garansi Resmi 2 Tahun", "Ready Stock")
- Footer multi-kolom dengan kontak & jam operasional toko lengkap
- Navigasi kategori bersih dengan dropdown
- Whitespace generous — produk jadi fokus utama

Yang diadaptasi / tidak dipakai:
- Harga **wajib ditampilkan** di HNS (Aftershock tidak tampilkan di homepage)
- Tidak pakai licensed IP / custom illustration — ganti dengan logo brand mitra resmi (Asus, MSI, Acer, dll)
- Tidak pakai tone aspirational premium — HNS lebih approachable & value-focused

---

## Pertanyaan Terbuka (Belum Diputuskan)

| # | Pertanyaan | Dampak ke |
|---|---|---|
| 1 | Diskon member berbasis apa? (per-produk / per-kategori / persentase flat) | Arsitektur rule engine di Next.js |
| 2 | Field wajib di form register — nama, email, password, nomor HP, ada tambahan? | Form `/register` |
| 3 | Apakah CS input order WA manual ke WooCommerce? | Riwayat order di `/account` |