# 18. Kabar Tautan & Harga Web → Web Data (hook)

> **Status 26 Oktober 2026.** Sisi ecommerce **selesai**, mati bawaan
> (`HNS_WEB_LINKS_ENABLED=false`). Sisi web Data (repo `sync-accurate`)
> **belum dibangun** — §7 adalah panduannya. Keputusan & latar: docs/13 §11.

---

## 1. Untuk apa

Halaman barang di web Data (data.hnsitcenter.id) perlu tahu, per barang
Accurate:

- apakah barang itu **sudah tertaut** ke produk web, ditandai **"tidak dijual
  di web"**, atau **belum**;
- kalau tertaut: produk web yang mana (termasuk variannya), tayang atau tidak,
  dan **harga jualnya di web**.

Dengan itu web Data bisa menampilkan lencana "sudah match", dan menandai barang
yang harga webnya berbeda dari harga Accurate — kasus seperti Asus TUF F16 yang
dijual Rp 18,6 jt di web tapi Rp 21,9 jt di kasir (docs/13 §7).

---

## 2. Gambaran besar: web Data sebagai pusat

```
                ┌──────────── web Data (pusat) ────────────┐
Accurate ──────►│ barang, stok, HPP  +  tautan & harga web │
                └───▲──────────────────────┬───────────────┘
   POST pakai token │                      │ GET pakai token masing-masing
                    │                      ▼
              Ecommerce          aplikasi lain (nanti, mis. Ticketing)
```

- Setiap aplikasi cukup **satu client** di halaman API & Integrasi web Data.
  Ecommerce memakai token yang SAMA untuk membaca stok dan mengirim tautan —
  mencabut client itu memutus keduanya sekaligus.
- Ecommerce tidak membuka API sendiri, dan web Data tidak membaca database
  ecommerce.

---

## 3. Alur hook

### 3.1 Kabar seketika — `links.changed`

```
Staff menyimpan/menautkan di admin ecommerce
        │
        ▼
lapisan data ecommerce (tautkanKode, updateProduct, …)
        │  kabariWebData(kode)  → antrean, digabung per proses
        ▼
balasan "tersimpan" ke staff   ← staff TIDAK menunggu kiriman
        │
        ▼  sesudah balasan (next/server `after`)
POST {HNS_API_URL}/web-links
Authorization: Bearer <HNS_API_TOKEN>
{ "event": "links.changed", "readAt": "…", "items": [ … ] }
        │
        ▼
web Data: withApiClient → izin webLinks → upsert tabel web_links (per kode)
        │
        ▼
lencana & harga web di /barang dan modal barang (Super Admin / owner)
```

Gagal kirim **tidak diulang** (Hostinger tidak punya antrean kerja); dicatat ke
log server ecommerce. Salinan berikutnya yang membetulkan.

### 3.2 Salinan utuh — `links.snapshot`

```
Cron hPanel (±2 jam) → POST /api/cron/sinkron-stok (ecommerce)
        │
        ├─► sinkron stok dari API Data (seperti biasa)
        │
        └─► kirimSalinanTautan()
              readAt = sekarang  ← diambil SEBELUM database dibaca
              baca SEMUA kode tertaut + ditandai
              kirim berbagian, 500 kode per bagian, satu snapshotId
                    │
                    ▼
            web Data: upsert tiap bagian; setelah SEMUA bagian diterima,
            kode yang tidak ada di salinan → "belum" (aturan §6.4)
```

Salinan menangkap tiga hal yang tidak pernah memicu kabar seketika: kiriman
yang gagal, perubahan lewat skrip operasi (menulis langsung ke database), dan
promo yang berakhir sendiri. Hasilnya ikut di body balasan cron sebagai
`kabarWebData`; gagalnya tidak membuat balasan cron 500.

---

## 4. Pemicu

| Kejadian di ecommerce | Fungsi | Kode yang dikirim |
|---|---|---|
| Tautkan, lepas, atau ganti kode Accurate (dialog Update Harga, Quick Edit, form produk) | `tautkanKode` | kode lama + kode baru |
| Tautan otomatis dari SKU saat produk disimpan | `tautkanDariSku` → `tautkanKode` | kode yang ditautkan |
| Tandai / batalkan "tidak dijual di web" (satuan & massal) | `abaikanKode(Massal)`, `batalkanAbaikan(Massal)` | kode itu |
| Simpan produk: harga, nama, status tayang, varian (form, Quick Edit, harga cepat, massal) | `updateProduct` | kode produk + semua variannya |
| Hapus produk | `deleteProduct` | kode produk + variannya (diambil sebelum dihapus) |

**Tidak memicu:** sinkron stok (stok tidak dikirim — web Data sudah punya),
skrip operasi, promo yang berakhir sendiri. Ketiganya tertangkap salinan.

Beberapa perubahan dalam satu permintaan (penyuntingan massal) digabung jadi
satu kiriman.

---

## 5. Kontrak HTTP

### 5.1 Permintaan

```
POST https://data.hnsitcenter.id/api/v1/web-links
Authorization: Bearer hns_…            ← token client "HNS IT Center (Ecommerce)"
Content-Type: application/json
User-Agent: HNS-Ecommerce/1.0
X-HNS-Event: ping | links.changed | links.snapshot
X-HNS-Delivery: <uuid>                 ← sama dengan deliveryId di body
```

### 5.2 Balasan yang diharapkan

| Keadaan | Balasan |
|---|---|
| Diterima | **2xx**, dalam **5 detik** (bagian salinan: 10 detik) |
| Token salah / client nonaktif / izin tidak ada | 401 / 403 dengan bentuk galat API v1: `{ "error": { "code", "message" } }` |
| Body tidak dikenal | 400, bentuk yang sama |

- `message` ikut dicatat di log ecommerce dan ditampilkan skrip uji — tulis
  pesan yang menjelaskan.
- Pengalihan (3xx) dianggap gagal: ecommerce tidak mengirim token ke alamat lain.
- Batas 120 request/menit per token **dibagi** dengan pembacaan stok (±15
  request per sinkron). Kiriman tautan jauh di bawah batas itu.

### 5.3 Jenis kiriman

```jsonc
// ping — tes sambungan & token, tanpa data barang
{ "event": "ping", "deliveryId": "…", "sentAt": "…", "message": "Tes kabar dari web ecommerce HNS." }

// links.changed — keadaan TERBARU kode-kode yang berubah (bukan selisih)
{
  "event": "links.changed",
  "deliveryId": "6f1c…",
  "sentAt": "2026-10-26T08:00:01.120Z",
  "readAt": "2026-10-26T08:00:01.050Z",   // kapan keadaan ini dibaca dari database web
  "count": 1,
  "items": [ /* KeadaanTautan[], maks. 500 */ ]
}

// links.snapshot — SELURUH kode tertaut + ditandai, berbagian
{
  "event": "links.snapshot",
  "deliveryId": "…",
  "sentAt": "…",
  "snapshotId": "uuid — sama untuk semua bagian satu salinan",
  "readAt": "…",                           // SATU nilai untuk semua bagian, diambil sebelum database dibaca
  "part": 1,
  "totalParts": 3,
  "count": 500,
  "items": [ /* KeadaanTautan[] */ ]
}
```

### 5.4 `KeadaanTautan` — satu per kode Accurate

```jsonc
{
  "kode": "2610000123",          // kode barang Accurate = items.no (SKU) di web Data
  "status": "tertaut",           // "tertaut" | "diabaikan" | "belum"
  "produk": {                    // null kecuali "tertaut"
    "id": 12345,                 // id produk di panel admin ecommerce (/admin/produk/<id>); varian → id INDUKNYA
    "nama": "Contoh Laptop 14 i5 16GB",
    "jenis": "variable",         // "simple" | "variable"
    "varian": {                  // null untuk produk simple
      "id": 67890,
      "nama": "Hitam",           // label pembeda varian
      "sku": "2610000123"
    },
    "tayang": true,              // terlihat pelanggan (produk / induknya berstatus terbit)
    "url": "https://hnsitcenter.id/product/contoh-laptop-14?sku=2610000123",
    "adminUrl": "https://hnsitcenter.id/admin/produk/12345",
    "harga": {
      "normal": 9500000,         // null kalau belum diisi
      "promo": 8999000,          // terisi HANYA kalau promo sedang berlaku saat dibaca
      "promoBerakhir": "2026-10-31T16:59:59.000Z"   // ISO UTC; null = tanpa batas / tanpa promo
    }
  }
}
```

| Status | Arti |
|---|---|
| `tertaut` | Kode menambat satu produk web (`products.accurate_code`, unik) |
| `diabaikan` | Staff menandainya "tidak dijual di web" di Update Harga |
| `belum` | Bukan keduanya — termasuk kode yang baru dilepas atau produknya dihapus |

Contoh nyata dari database lokal bisa dilihat kapan saja tanpa mengirim:
`kirim-kabar-web-data.mts contoh --lihat` (§9).

---

## 6. Aturan di sisi penerima

1. **Upsert per `kode`**, tanpa peduli huruf besar/kecil (kolom `accurate_code`
   ecommerce tak peka huruf).
2. **Yang lebih baru menang, berdasarkan `readAt`** — bukan urutan datangnya.
   Simpan `read_at` per kode, dan terapkan item hanya kalau `readAt` kiriman
   ≥ `read_at` tersimpan. Tanpa ini, bagian salinan yang dibaca pukul 08.00
   lalu tiba pukul 08.00.03 menimpa kabar seketika pukul 08.00.01 dengan harga
   lama. Kedua waktu itu dari jam server ecommerce, jadi saling sebanding.
3. **Kode → barang Accurate lewat SKU** (`items.no`). SKU bisa dipakai ulang
   setelah barang lama dihapus; kalau ada dua barang ber-SKU sama, dahulukan
   yang aktif.
4. **Salinan dituntaskan hanya kalau lengkap.** Catat bagian yang diterima per
   `snapshotId`. Setelah SEMUA bagian `1..totalParts` masuk, jadikan `belum`
   setiap kode yang **tidak** ada di salinan itu **dan** `read_at`-nya lebih tua
   dari `readAt` salinan — kode yang tertaut sesudah salinan dibaca tidak boleh
   ikut dilepas. Salinan yang bagiannya tidak lengkap diabaikan saja; berikutnya
   datang ±2 jam lagi. Salinan kosong tetap dikirim satu bagian.
5. **Harga yang berlaku** = `promo` kalau terisi dan `promoBerakhir` kosong atau
   belum lewat; selain itu `normal`. Sama dengan keranjang ecommerce. Jangan
   menghitung harga lain dari angka ini (CLAUDE.md §2.7 ecommerce) — dan harga
   yang DITAGIHKAN ke pelanggan tetap dari katalog ecommerce, bukan salinan ini.
6. **Hanya Super Admin / owner** yang boleh melihat indikator & harga web.
   Kalau suatu saat dibuka ke client lain lewat API, jadikan izin tersendiri
   (mis. "Harga web"), seperti "Harga jual" dan "HPP".

---

## 7. Membangun penerima di web Data (`sync-accurate`)

Yang sudah tersedia di sana dan tinggal dipakai:

- `withApiClient()` di `lib/api/auth.ts` — token Bearer → client, client
  nonaktif ditolak, batas 120/menit, "Terakhir dipakai" tercatat.
- `ApiScopes` (`lib/db/schema.ts`) disimpan sebagai JSON — izin baru **tanpa migrasi**.
- `proxy.ts` sudah meloloskan `/api/v1/` tanpa login.

Ikuti aturan CLAUDE.md repo itu: migrasi & uji di **`da_test`** dulu, bukan VPS
produksi; `npm run dev` bawaan menunjuk database produksi.

### Langkah 1 — izin client `webLinks`

- `lib/db/schema.ts`: tambah `webLinks?: boolean` di `ApiScopes`
  ("Boleh mengirim tautan & harga web. Client lama: tidak ada = false.").
- `components/api/client-manager.tsx`: Switch "Kirim tautan & harga web" di
  form Ubah client, dan chip-nya di kartu client.
- `GET /api/v1/status`: tampilkan `scopes.webLinks`.
- Komentar `withApiClient` ("Hanya GET") diperbarui — API v1 kini punya satu
  jalur tulis, khusus data milik web Data sendiri (tidak menyentuh Accurate).

### Langkah 2 — tabel `web_links` (migrasi baru, `da_test` dulu)

| Kolom | Tipe | Catatan |
|---|---|---|
| `kode` | varchar(64), PK | huruf besar, dipangkas |
| `status` | varchar(16) | tertaut / diabaikan / belum |
| `produk_id`, `varian_id` | int, null | |
| `produk_nama` | varchar(512), null | |
| `jenis` | varchar(16), null | simple / variable |
| `varian_nama`, `varian_sku` | varchar, null | |
| `tayang` | boolean, null | |
| `url`, `admin_url` | varchar(1000), null | |
| `harga_normal`, `harga_promo` | decimal(14,2), null | |
| `promo_berakhir` | datetime, null | |
| `read_at` | datetime(3) | aturan §6.2 |
| `snapshot_id` | varchar(36), null | salinan terakhir yang menyentuh baris ini |
| `client_id` | int | client pengirim |
| `updated_at` | datetime | waktu diterima |

Plus `web_link_snapshot_parts (snapshot_id, part)` unik — untuk tahu kapan
salinan lengkap (aturan §6.4).

### Langkah 3 — route `app/api/v1/web-links/route.ts`

```ts
import { apiError, apiJson, withApiClient } from "@/lib/api/auth";
import { terapkanKabarTautan, tuntaskanSalinan } from "@/lib/api/web-links";

export async function POST(req: Request) {
  return withApiClient(req, async (client) => {
    if (!client.scopes.webLinks) {
      return apiError(403, "forbidden", "Client ini tidak diizinkan mengirim tautan web. Nyalakan di API & Integrasi.");
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body.event !== "string") return apiError(400, "invalid_parameter", "Body bukan kiriman yang dikenal.");

    if (body.event === "ping") return apiJson({ ok: true, client: client.name });

    if (body.event === "links.changed" || body.event === "links.snapshot") {
      if (!Array.isArray(body.items) || typeof body.readAt !== "string") {
        return apiError(400, "invalid_parameter", "items / readAt tidak ada.");
      }
      // Upsert per kode; terapkan hanya kalau readAt >= read_at tersimpan (§6.2).
      await terapkanKabarTautan(client.id, body.items, new Date(body.readAt), body.snapshotId ?? null);
      // Salinan: catat bagian; kalau sudah 1..totalParts semua, lepas kode yang tidak ikut (§6.4).
      if (body.event === "links.snapshot") {
        await tuntaskanSalinan(body.snapshotId, body.part, body.totalParts, new Date(body.readAt));
      }
      return apiJson({ ok: true, count: body.items.length });
    }
    return apiJson({ ok: true, ignored: body.event });   // event baru: 2xx, jangan dianggap galat
  });
}
```

Upsert dengan aturan "yang lebih baru menang" dalam satu kueri MariaDB:

```sql
INSERT INTO web_links (kode, status, …, read_at, snapshot_id, client_id, updated_at)
VALUES (…), (…)
ON DUPLICATE KEY UPDATE
  status      = IF(VALUES(read_at) >= read_at, VALUES(status), status),
  -- … kolom lain dengan pola IF yang sama …
  snapshot_id = IF(VALUES(read_at) >= read_at, VALUES(snapshot_id), snapshot_id),
  updated_at  = NOW(),
  read_at     = GREATEST(read_at, VALUES(read_at));   -- WAJIB paling akhir
```

`read_at` harus diperbarui **paling akhir**: MariaDB mengevaluasi penugasan dari
kiri ke kanan, dan kolom yang dirujuk sesudah ia diubah sudah bernilai baru —
`IF` di baris-baris sebelumnya akan membandingkan dengan nilai yang salah.

Penuntasan salinan (§6.4), dijalankan setelah bagian terakhir tercatat:

```sql
UPDATE web_links
SET status = 'belum', produk_id = NULL, produk_nama = NULL, … , harga_promo = NULL, promo_berakhir = NULL
WHERE status <> 'belum'
  AND (snapshot_id IS NULL OR snapshot_id <> :snapshotId)
  AND read_at < :readAt;
```

### Langkah 4 — tampilan

- Daftar Data Barang (`/barang`): lencana per barang, join
  `UPPER(items.no) = web_links.kode` — "Web" (tertaut), "Tidak dijual di web",
  atau kosong; filter "Tertaut web / Belum / Tidak dijual di web".
- Modal barang: produk web (tautan ke `url` dan `admin_url`), tayang/tidak,
  harga web yang berlaku (aturan §6.5) berdampingan dengan harga jual Accurate,
  dan tanda **"harga beda"** kalau tidak sama.
- Izin baru (mis. `items.web.view`), hanya Super Admin & owner (§6.6).

### Langkah 5 — uji di `da_test`, lalu produksi

Lihat §9 untuk mengirim dari ecommerce ke web Data lokal.

---

## 8. Menyalakan di produksi (urutan penting)

1. **Web Data**: deploy penerima + migrasi produksi (sesuai prosedur repo itu).
2. **API & Integrasi** → kartu "HNS IT Center (Ecommerce)" → **⋯** → **Ubah izin &
   webhook** → nyalakan **"Kirim tautan & harga web"** → Simpan.
3. **hPanel ecommerce** → Environment variables: `HNS_WEB_LINKS_ENABLED=true`,
   deploy ulang (env hanya dibaca saat server mulai).
4. **Isi awal**: tunggu putaran cron berikutnya, atau panggil manual:
   ```bash
   curl -fsS -m 120 -X POST -H "Authorization: Bearer <CRON_SECRET>" https://hnsitcenter.id/api/cron/sinkron-stok
   ```
   Body balasannya memuat `kabarWebData: { ok: true, kode, bagian }`.
5. **Cek kabar seketika**: simpan satu produk tertaut di admin ecommerce —
   lencananya di web Data harus berubah dalam hitungan detik. Ini juga satu-
   satunya pemeriksaan jalur `after()` di dalam permintaan sungguhan (§10).

Urutan 1–2 sebelum 3 itu disengaja: kalau sakelar dinyalakan lebih dulu,
setiap simpan produk mencatat galat 404/403 di log sampai penerimanya siap.

---

## 9. Menguji di laptop

**Web Data lokal** (repo `sync-accurate`), ikuti CLAUDE.md-nya:

- arahkan ke `da_test` (Docker `data-accurate-test`, `127.0.0.1:3311`), bukan
  produksi — `.env.development.local` bawaan menunjuk VPS produksi;
- `BACKGROUND_JOBS=off`;
- jalankan di port 3001: `npm run dev -- -p 3001`;
- buat client uji di halaman API & Integrasi lokal, nyalakan "Kirim tautan &
  harga web", salin tokennya.

**Ecommerce** (`.env.local`), sementara selama menguji:

```env
HNS_API_URL=http://localhost:3001/api/v1
HNS_API_TOKEN=<token client uji dari da_test>
HNS_WEB_LINKS_ENABLED=true
```

Kembalikan `HNS_API_URL`/`HNS_API_TOKEN` sesudahnya — selama menunjuk lokal,
sinkron stok ecommerce membaca web Data lokal. Penjaga bawaan: kalau database
ecommerce lokal, kiriman hanya mau ke `localhost`.

**Kirim manual** (membaca `.env.local`, tidak menulis database):

```bash
npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server \
  scripts/kirim-kabar-web-data.mts <ping | contoh | kode <k1> [k2 …] | salinan> [--lihat]
```

Urutan yang disarankan: `ping` → `contoh` → `salinan` → simpan satu produk
tertaut di admin lokal (restart `npm run dev` dulu).

---

## 10. Kalau ada masalah

Pesan muncul di keluaran skrip, di log server ecommerce (`[kabar-tautan]`), dan
di body balasan cron (`kabarWebData`).

| Pesan | Artinya | Yang dilakukan |
|---|---|---|
| `HNS_WEB_LINKS_ENABLED belum true` | Sakelar mati (bawaan) | Isi `true`, restart/deploy ulang |
| `Database lokal tidak dikirim ke web Data selain localhost` | Penjaga: DB lokal, `HNS_API_URL` produksi | Arahkan `HNS_API_URL` ke web Data lokal (§9) |
| `HTTP 404: balasan berupa halaman HTML …` | Route `/api/v1/web-links` belum ada, atau URL salah | Deploy penerima / periksa `HNS_API_URL` |
| `HTTP 401: Token tidak dikenal atau sudah diganti.` | Token salah atau sudah di-"Ganti token" | Perbarui `HNS_API_TOKEN` |
| `HTTP 403: Client ini sedang dinonaktifkan.` | Client dinonaktifkan di web Data | Aktifkan lagi |
| `HTTP 403: … tidak diizinkan mengirim tautan web …` | Izin `webLinks` belum dinyalakan | §8 langkah 2 |
| `HTTP 429` | Lebih dari 120 request/menit | Tidak perlu apa-apa; salinan berikutnya membetulkan |
| `fetch failed (connect ECONNREFUSED …)` | Web Data mati / port salah | Nyalakan, periksa port |
| `… aborted due to timeout` | Penerima membalas lebih dari 5 detik | Percepat penerima; kerja berat jangan menahan balasan |

Yang **belum** teruji otomatis: jalur `after()` di dalam permintaan Next
sungguhan — skrip uji berjalan di luar permintaan, jadi ia menguji jalur
cadangannya (`setTimeout`). Langkah §8.5 menutupnya.

---

## 11. Kode di ecommerce

| Berkas | Isi |
|---|---|
| `src/lib/api/hns-data/kabar-tautan.ts` | Seluruh pengirim: `kabariWebData`, `kirimKeadaan`, `kirimSalinanTautan`, `kirimPing`, penjaga `periksaTujuan`, jalur baca `keadaanTautan` / `semuaKeadaanTautan` |
| `src/lib/api/accurate/price-table.ts` | Pemicu di `tautkanKode`, `abaikanKode(Massal)`, `batalkanAbaikan(Massal)` |
| `src/lib/api/woocommerce/products.ts` | Pemicu di `updateProduct`, `deleteProduct` (kode diambil sebelum transaksi) |
| `src/app/api/cron/sinkron-stok/route.ts` | Salinan utuh tiap putaran cron |
| `src/config/env.ts` | `HNS_WEB_LINKS_ENABLED` |
| `scripts/kirim-kabar-web-data.mts` | Kirim manual / lihat isi kiriman |
| `scripts/uji-kabar-tautan.mts` | Uji otomatis (31 pemeriksaan, DB lokal + penerima tiruan) |
