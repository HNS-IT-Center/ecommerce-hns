# PROJECT BRIEF — HNS IT Center Web Rebuild

> Dokumen ini adalah **brief lengkap project**. Untuk stakeholder, developer, dan AI agent.
> Berisi konteks utuh + peta seluruh dokumentasi + hal-hal yang belum tercakup di file-file lain.

---

## 1. Tentang Dokumen Ini

Dokumen ini menutup gap yang belum tercakup di file-file rules sebelumnya (`CLAUDE.md`, `docs/01-07`). Isinya:

- Ringkasan project untuk stakeholder yang tidak ingin baca 9 file.
- Design system & visual identity (belum ada di file lain).
- Migration & SEO strategy (turunan dari analisis .docx sebelumnya).
- Testing strategy detail.
- Git workflow & PR template.
- Definition of Done.
- Glossary istilah bisnis.
- Roadmap fase.
- Setup scripts & tooling.

---

## 2. Ringkasan Project

**Nama:** HNS IT Center Web Rebuild
**Klien internal:** PT. Sentral Berkat Teknologi (pemilik HNS IT Center Batam)
**Website lama:** hnsitcenter.id (WordPress + WooCommerce)
**Tujuan:** Membangun frontend baru berbasis Next.js untuk meningkatkan performa, SEO, dan pengalaman pengguna, tanpa kehilangan data & tanpa downtime besar.

**Strategi utama:** Migrasi bertahap (Strangler Fig Pattern) — WooCommerce tetap jadi backend data, Next.js jadi frontend baru yang perlahan menggantikan tema WordPress lama.

**Timeline estimasi kasar:** 4–6 bulan dari kickoff sampai full cutover (detail di bagian 9).

---

## 3. Peta Dokumentasi

```
Repo Root
├── README.md                      ← Untuk siapapun yang buka repo (setup lokal, cara run)
├── PROJECT_BRIEF.md               ← FILE INI (brief lengkap + design system + roadmap)
├── CLAUDE.md                      ← Rules untuk AI agent
├── .env.example                   ← Template env vars
├── .gitignore                     ← Aturan file yang tidak di-commit
└── docs/
    ├── 01-business-context.md     ← Bisnis, produk, layanan, persona
    ├── 02-architecture.md         ← Struktur folder, Server vs Client Component
    ├── 03-state-management.md     ← Server/URL/Local/Global state
    ├── 04-component-guidelines.md ← Panduan komponen UI
    ├── 05-data-fetching.md        ← WooCommerce API + caching
    ├── 06-coding-standards.md     ← TypeScript, naming, format
    └── 07-environment-variables.md ← Daftar env + cara dapatnya
```

**Prioritas baca untuk role berbeda:**

| Role | Wajib baca urut |
|---|---|
| Stakeholder / owner | PROJECT_BRIEF.md (file ini), 01-business-context.md |
| Developer baru | README.md → PROJECT_BRIEF.md → CLAUDE.md → docs/02 → docs/06 |
| AI agent | CLAUDE.md → docs sesuai konteks task |
| Designer | PROJECT_BRIEF.md (bagian 4) → docs/04-component-guidelines.md |
| DevOps | docs/07-environment-variables.md → PROJECT_BRIEF.md (bagian 8) |

---

## 4. Design System & Visual Identity

Aturan visual yang **wajib** diikuti supaya UI konsisten dan mencerminkan brand HNS IT Center.

### 4.1 Brand Voice

- **Trustworthy** — retailer resmi dengan toko fisik & teknisi profesional.
- **Straightforward** — jelas & langsung, tidak berlebihan.
- **Approachable** — casual tapi kompeten. Cocok untuk gamer & professional.
- **Local pride** — bangga sebagai toko IT Batam.

Copywriting **HINDARI**: hype berlebihan, gimmick, superlatif tanpa dasar ("terbaik di dunia!"), tone kekanak-kanakan.

### 4.2 Color Palette

Warna diambil dari website lama (yang sudah dikenal customer) + ditingkatkan konsistensinya:

| Token | Hex | Pemakaian |
|---|---|---|
| `primary` | `#0F172A` (navy dark) | Header, teks utama, tombol primer |
| `primary-foreground` | `#FFFFFF` | Teks di atas primary |
| `accent` | `#DC2626` (red) | CTA penting, badge SALE, notifikasi urgent |
| `accent-foreground` | `#FFFFFF` | Teks di atas accent |
| `success` | `#16A34A` | Badge stok tersedia, success message |
| `warning` | `#F59E0B` | Stok menipis, warning |
| `danger` | `#DC2626` | Error, stok habis, destructive action |
| `background` | `#FFFFFF` | Latar utama |
| `muted` | `#F1F5F9` | Latar section alternatif, skeleton |
| `border` | `#E2E8F0` | Border card, divider |
| `text` | `#0F172A` | Teks utama |
| `text-muted` | `#64748B` | Teks sekunder, caption |

Semua ini disimpan sebagai CSS variables + Tailwind config, jangan hardcode hex di komponen.

### 4.3 Typography

- **Font sans:** Inter (via `next/font/google`) — untuk seluruh UI.
- **Font mono:** JetBrains Mono — untuk kode/spek teknis (opsional).

**Type scale (mobile-first):**

| Token | Mobile | Desktop | Pemakaian |
|---|---|---|---|
| `text-xs` | 12px | 12px | Label kecil, badge |
| `text-sm` | 14px | 14px | Meta info, footer |
| `text-base` | 16px | 16px | Body text |
| `text-lg` | 18px | 18px | Lead paragraph |
| `text-xl` | 20px | 24px | Nama produk di card |
| `text-2xl` | 24px | 30px | H3 |
| `text-3xl` | 30px | 36px | H2 |
| `text-4xl` | 36px | 48px | H1 |

**Aturan:**
- Body text minimum 16px (WCAG readability).
- Line height 1.5 untuk body, 1.2 untuk heading.
- Font weight: 400 (regular), 500 (medium), 600 (semibold), 700 (bold). Jangan pakai 300 (thin) untuk body — tidak terbaca di layar kecil.

### 4.4 Spacing

Gunakan skala Tailwind default (4px base):
- `space-1` (4px), `space-2` (8px), `space-3` (12px), `space-4` (16px), `space-6` (24px), `space-8` (32px), `space-12` (48px), `space-16` (64px).

**Jangan pakai:** `space-1.5`, `space-2.5`, dsb — tetap di kelipatan 4.

### 4.5 Border Radius

- `rounded-sm` (2px) — jarang dipakai.
- `rounded` (4px) — badge, tag kecil.
- `rounded-md` (6px) — tombol, input.
- `rounded-lg` (8px) — card produk.
- `rounded-xl` (12px) — card besar, dialog.
- `rounded-full` — avatar, icon button.

Konsisten satu radius per konteks. Jangan campur `rounded` dan `rounded-md` di komponen sejenis.

### 4.6 Shadow

Minimalis — retailer profesional, bukan showcase 3D:
- `shadow-sm` — card default.
- `shadow-md` — card hover, dropdown.
- `shadow-lg` — dialog, modal.

**Hindari:** shadow warna-warni, glow effect, neon.

### 4.7 Icon

- Library: **lucide-react** (sudah di tech stack).
- Ukuran default: 20px untuk inline, 24px untuk tombol icon-only.
- Stroke width: 2 (default).
- Konsisten satu library — jangan campur dengan react-icons, heroicons, dll.

### 4.8 Prinsip Visual

**Do:**
- Whitespace generous — kasih napas antar elemen.
- Hierarki jelas — user tahu apa yang paling penting di setiap halaman.
- Gambar produk jadi bintang — background netral, gambar besar.
- Loading skeleton yang mirip layout final.

**Don't:**
- Gradient warna-warni.
- Animasi berlebihan (parallax, fade-in di setiap section).
- Popup langsung muncul saat halaman load.
- Auto-play video/carousel yang tidak bisa di-pause.
- Warna neon atau glow.

---

## 5. Migration & SEO Strategy (Ringkasan Actionable)

Detail lengkap ada di dokumen analisis migrasi `.docx` sebelumnya. Berikut ringkasan yang harus diikuti developer & agent:

### 5.1 Prinsip Migrasi

1. **Zero data migration di Fase 1** — WooCommerce tetap jadi sumber data, tidak pindah database.
2. **Cutover bertahap per-route**, bukan big bang. Reverse proxy (Cloudflare/Nginx) yang atur.
3. **WordPress lama tetap aktif** sebagai backend/admin sampai Fase 4 stabilisasi.

### 5.2 SEO Preservation — Wajib

- **URL structure IDENTIK** dengan lama:
  - Produk: `/product/<slug>`
  - Kategori: `/product-category/<slug>` (bisa alias ke `/category/<slug>`)
  - Blog: `/our-blog/<slug>` atau `/blog/<slug>` (pastikan mapping)
- Jika ada slug yang **berubah** → wajib **301 redirect permanen** (jangan 302).
- Simpan mapping redirect di `src/lib/redirects.ts` atau `middleware.ts`.
- Meta title, description, canonical **1:1** dengan yang di Yoast/RankMath lama untuk halaman terindeks.
- Structured data (schema.org): `Product`, `BreadcrumbList`, `Organization`, `Article` (blog), `LocalBusiness` (toko fisik).

### 5.3 Sitemap & Robots

- Generate `sitemap.xml` dinamis dari Next.js (`src/app/sitemap.ts`).
- Submit ulang ke Google Search Console **setelah setiap batch cutover**.
- Pantau Coverage Report harian selama 2 minggu pasca cutover.
- `robots.txt` di `src/app/robots.ts` — jangan lupa allow crawler.

### 5.4 Redirect Testing

Sebelum go-live per batch, jalankan:
- Screaming Frog crawl vs sitemap lama → cek 404.
- Test 10–20 URL sample yang paling banyak traffic (dari GA/GSC).
- Test WhatsApp share (Open Graph image, description).

### 5.5 Yang Wajib Dikerjakan Sebelum Cutover Pertama

- [ ] Export daftar URL dari Google Search Console sebagai baseline.
- [ ] Export sitemap.xml lama, simpan sebagai `docs/legacy-sitemap.xml`.
- [ ] Setup redirect mapping (spreadsheet) — URL lama vs URL baru.
- [ ] Setup Google Search Console untuk domain baru (jika beda domain saat testing).
- [ ] Setup 301 di `middleware.ts` atau Nginx reverse proxy.

---

## 6. Testing Strategy

Aturan minimum sudah disebut di `docs/06-coding-standards.md`. Detail lengkap:

### 6.1 Level Testing

| Level | Tools | Kapan Dipakai | Coverage Target |
|---|---|---|---|
| **Unit** | Vitest | Utility, pricing calc, formatter, validator | Fungsi utility di `lib/` wajib 100% |
| **Component** | Vitest + Testing Library | Komponen dengan logika (form, filter, cart) | Semua komponen `features/` yang punya state |
| **Integration** | Vitest + MSW | Data flow: form → API → response | Critical flow: add to cart, checkout, filter |
| **E2E** | Playwright | Full user journey | Minimal 3 flow: browse → cart → checkout, search → product detail, service booking |

### 6.2 Prinsip Testing

- Test **perilaku**, bukan implementasi. Jangan test detail `useState` internal — test apa yang user lihat & klik.
- Gunakan **query prioritas** Testing Library: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`.
- Mock WooCommerce API di test dengan MSW (Mock Service Worker), bukan mock fetch global.
- Snapshot testing hanya untuk komponen visual sederhana yang jarang berubah.

### 6.3 CI Pipeline

Setiap PR wajib lolos:
```
1. pnpm typecheck     ← TypeScript
2. pnpm lint          ← ESLint
3. pnpm test          ← Vitest (unit + component + integration)
4. pnpm build         ← Next.js build success
5. pnpm test:e2e      ← Playwright (di preview deploy)
```

Setup GitHub Actions atau equivalent.

### 6.4 Test yang WAJIB Ada Sebelum Go-Live

- [ ] E2E: guest → browse → add to cart → checkout (bayar sandbox).
- [ ] E2E: search "vga" → klik produk → tampil detail.
- [ ] E2E: WhatsApp order button → link WA dengan pesan pre-filled benar.
- [ ] Unit: `formatPrice`, `calculateDiscount`, `parseFilters` (URL → object).
- [ ] Integration: Add to cart → cart store update → persist ke localStorage.

---

## 7. Git Workflow

### 7.1 Branch Strategy

- `main` — production. Protected, hanya bisa merge lewat PR.
- Feature branch dari `main`:
  - `feat/nama-fitur` — fitur baru.
  - `fix/nama-bug` — perbaikan bug.
  - `chore/nama` — refactor, upgrade dependency.
  - `docs/nama` — perubahan dokumentasi.

### 7.2 Commit Message

Ikuti Conventional Commits:
```
feat(product): add variation selector
fix(cart): correct price calculation for sale items
chore(deps): upgrade next to 14.2.5
docs(architecture): clarify BFF pattern
refactor(search): extract query builder to lib
```

### 7.3 PR Template

Simpan di `.github/pull_request_template.md`:

```markdown
## Ringkasan
<!-- Apa yang berubah? Kenapa? -->

## Jenis Perubahan
- [ ] Fitur baru
- [ ] Bug fix
- [ ] Refactor
- [ ] Docs
- [ ] Chore / dependency

## Testing
<!-- Bagaimana kamu memastikan ini bekerja? -->
- [ ] Manual test di local
- [ ] Unit test ditambah/diupdate
- [ ] E2E test ditambah/diupdate

## Screenshot (jika UI)
<!-- Before / After -->

## Checklist
- [ ] TypeScript lulus (`pnpm typecheck`)
- [ ] Lint lulus (`pnpm lint`)
- [ ] Test lulus (`pnpm test`)
- [ ] Responsive di mobile & desktop
- [ ] Tidak ada `console.log` tersisa
- [ ] Tidak ada `any` tanpa justifikasi
- [ ] Env baru sudah ditambah ke `.env.example` & `docs/07`
- [ ] Dokumentasi diupdate jika perlu

## Related Issue
Closes #
```

### 7.4 Review Checklist untuk Reviewer

- [ ] Kode terbaca (bukan clever, tapi clear).
- [ ] Naming sesuai konvensi (docs/06).
- [ ] Tidak duplikasi dengan yang sudah ada.
- [ ] Handle error & edge case.
- [ ] Test yang tepat (bukan snapshot untuk komponen dinamis).
- [ ] Perubahan API di-cover di `docs/05`.
- [ ] Perubahan komponen shared di-cover di `docs/04`.

---

## 8. Definition of Done (DoD)

Fitur dianggap **selesai** dan siap merge ke `main` **HANYA JIKA** semua ini terpenuhi:

### 8.1 DoD untuk Fitur

- [ ] Semua acceptance criteria di tiket terpenuhi.
- [ ] Kode lulus semua check CI (typecheck, lint, test, build).
- [ ] Test unit/integration ditambah untuk logika baru.
- [ ] Responsive di mobile (< 768px), tablet (768-1024px), desktop (> 1024px).
- [ ] Aksesibel: keyboard-navigable, contrast WCAG AA, screen reader OK.
- [ ] Loading, empty, error state ditangani.
- [ ] SEO: metadata, structured data (jika halaman publik).
- [ ] Reviewed & approved oleh minimal 1 reviewer.
- [ ] Sudah di-test di preview deploy (bukan hanya lokal).
- [ ] Dokumentasi diupdate (jika perubahan arsitektur, API, atau komponen shared).

### 8.2 DoD untuk Bug Fix

- [ ] Root cause dijelaskan di PR (bukan hanya patch symptom).
- [ ] Regression test ditambah supaya bug tidak balik.
- [ ] Lulus CI.
- [ ] Reviewed.

### 8.3 DoD untuk Cutover Batch (Go-Live per Kategori)

- [ ] Semua URL di batch punya redirect mapping (jika slug berubah).
- [ ] Metadata SEO sudah 1:1 dengan lama.
- [ ] Structured data valid (test dengan Google Rich Results Test).
- [ ] Manual test 10 URL sample teratas.
- [ ] Lighthouse score ≥ 90 di Performance & SEO.
- [ ] Rollback plan didokumentasikan (cara balik ke WordPress via reverse proxy).
- [ ] Tim CS diberitahu jadwal cutover.

---

## 9. Roadmap Fase

Ringkasan roadmap. Detail per fase akan dijabarkan di ticket / project management tool terpisah.

### Fase 0 — Foundation (2–3 minggu)
- Setup repo, tooling, CI.
- Setup design system (Tailwind config, warna, typography, komponen UI dasar dari shadcn).
- Setup WooCommerce API integration (client, product service, cache).
- Audit WooCommerce: jumlah produk, kategori, plugin aktif, custom logic.

### Fase 1 — Core Catalog (6–10 minggu)
- Halaman: Home, Shop (listing + filter), Product Detail, Category, Brand, Search.
- Cart & Checkout (versi WhatsApp order dulu, payment gateway menyusul).
- Blog (migrasi konten via API).
- Halaman statis: About, Contact, Store Locations, Claim & Support.
- SEO: metadata, sitemap, robots, structured data.

### Fase 2 — Enhancement (4–6 minggu)
- Checkout online dengan payment gateway (Midtrans/Xendit).
- User account: login, register, order history, wishlist.
- Custom PC Builder (fitur high-value, kompleks).
- Service Booking form.
- Search upgrade ke Meilisearch/Algolia.

### Fase 3 — Cutover (4–6 minggu)
- Cutover bertahap per-kategori lewat reverse proxy.
- Monitoring intensif SEO & analytics.
- Iterasi cepat berdasarkan feedback nyata.

### Fase 4 — Stabilization & Long-Term (berkelanjutan)
- Matikan akses publik tema WordPress lama setelah 100% traffic pindah.
- Evaluasi kebutuhan headless commerce dedicated (Medusa/Saleor) berdasarkan data pertumbuhan.
- Fitur lanjutan: product comparison, notifikasi stok, program loyalitas, B2B portal.

---

## 10. Setup & Tooling

### 10.1 Prasyarat

- Node.js **20+** (LTS).
- pnpm **9+** (`npm install -g pnpm`).
- Git.
- Akses ke wp-admin untuk generate WooCommerce API key.
- Editor: VS Code recommended (extension list di bawah).

### 10.2 Setup Repo (Sekali di Awal)

```bash
# 1. Buat Next.js project
pnpm create next-app@latest hns-web --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"

# 2. Copy semua file brief ke root repo
# CLAUDE.md, PROJECT_BRIEF.md, README.md, .env.example, .gitignore, docs/

# 3. Install dependency tambahan
pnpm add zustand @tanstack/react-query zod react-hook-form @hookform/resolvers
pnpm add lucide-react clsx tailwind-merge class-variance-authority
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
pnpm add -D @playwright/test msw
pnpm add -D prettier prettier-plugin-tailwindcss

# 4. Init shadcn/ui
pnpm dlx shadcn@latest init

# 5. Copy .env.example ke .env.local & isi
cp .env.example .env.local
```

### 10.3 Standard Scripts di `package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "env:check": "tsx src/config/env.ts && echo 'Env OK'",
    "prepare": "husky install"
  }
}
```

### 10.4 VS Code Extensions Rekomendasi

Simpan di `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "streetsidesoftware.code-spell-checker",
    "yoavbls.pretty-ts-errors",
    "ms-playwright.playwright"
  ]
}
```

---

## 11. Glossary — Istilah Bisnis & Teknis

Supaya konsisten di UI copy, code, dan komunikasi tim.

### 11.1 Istilah Bisnis (Bahasa Indonesia untuk UI)

| Istilah | Definisi | Padanan Inggris (untuk code) |
|---|---|---|
| **Rakit PC** | Layanan merakit PC custom sesuai spec customer | Custom PC Build |
| **Prebuilt PC** | PC yang sudah dirakit HNS, siap jual | Prebuilt PC |
| **Perakitan** | Jasa merakit part yang dibeli customer | Assembly Service |
| **Upgrade** | Ganti/tambah komponen di PC/laptop lama customer | Upgrade Service |
| **Service** | Perbaikan hardware/software | Repair Service |
| **Klaim Garansi** | Proses klaim produk bermasalah dalam masa garansi | Warranty Claim |
| **After Sales** | Layanan setelah pembelian (retur, garansi, konsultasi) | After Sales |
| **Gaming Gear** | Aksesoris gaming: keyboard, mouse, headset, dll | Gaming Gear |
| **PC Components** | Komponen PC: CPU, motherboard, RAM, VGA, dll | PC Components |
| **Stok Menipis** | Produk dengan stok < 5 (angka konfigurasi) | Low Stock |
| **Stok Habis** | Produk stok = 0 | Out of Stock |

### 11.2 Istilah Teknis

| Istilah | Definisi |
|---|---|
| **BFF** | Backend For Frontend — API layer di Next.js yang bungkus WooCommerce |
| **ISR** | Incremental Static Regeneration — Next.js caching dengan revalidate |
| **RSC** | React Server Component — komponen yang dirender di server |
| **Strangler Fig** | Pattern migrasi bertahap (bagian demi bagian) |
| **Cutover** | Momen pemindahan traffic dari sistem lama ke baru |
| **Webhook Revalidation** | WooCommerce kirim signal saat data berubah → Next.js clear cache |
| **Facet / Faceted Search** | Filter search berdasarkan atribut (kategori, harga, brand) |
| **Slug** | Bagian URL yang menggambarkan konten (contoh: `vga-rtx-4060`) |

---

## 12. Ownership & Kontak

| Peran | Nama | Kontak |
|---|---|---|
| Product Owner | [isi] | [isi] |
| Tech Lead | [isi] | [isi] |
| Designer | [isi] | [isi] |
| DevOps | [isi] | [isi] |
| CS Coordinator (untuk cutover coordination) | [isi] | [isi] |

**Channel komunikasi:**
- Daily update: [Slack/Discord/WA group]
- Ticket tracking: [Notion/Linear/Jira]
- Design: [Figma link]
- Repo: [GitHub URL]

---

## 13. Referensi Eksternal

- Dokumentasi Next.js: https://nextjs.org/docs
- Dokumentasi WooCommerce REST API: https://woocommerce.github.io/woocommerce-rest-api-docs/
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com/
- TanStack Query: https://tanstack.com/query
- Zustand: https://zustand-demo.pmnd.rs/
- Google Search Console: https://search.google.com/search-console
- Web Vitals: https://web.dev/vitals/

---

## 14. Perubahan Dokumen

Setiap perubahan signifikan ke dokumen brief dicatat di sini.

| Tanggal | Versi | Perubahan | Oleh |
|---|---|---|---|
| 2026-07-01 | 1.0 | Dokumen awal | - |

---

## 15. Prinsip Terakhir

> **Brief ini bukan aturan yang mati.** Kalau ada bagian yang tidak masuk akal di tengah project, angkat & diskusikan — jangan hanya diikuti karena "sudah tertulis". Yang penting bukan compliance ke dokumen, tapi menghasilkan produk terbaik untuk customer HNS IT Center.
