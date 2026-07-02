# HNS IT Center — Next.js Web

Rebuild frontend e-commerce **HNS IT Center Batam** (hnsitcenter.id) dari WordPress ke Next.js.
Backend data tetap dari WooCommerce lewat REST API.

---

## Quick Start

```bash
# 1. Clone repo
git clone <repo-url> hns-web
cd hns-web

# 2. Install dependency
pnpm install

# 3. Setup environment
cp .env.example .env.local
# Isi minimal 8 variabel WAJIB (lihat docs/07-environment-variables.md bagian 2.1)

# 4. Validasi env
pnpm env:check

# 5. Jalankan development server
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## Prasyarat

- **Node.js 20+** (LTS)
- **pnpm 9+** — install: `npm install -g pnpm`
- **Git**
- Akses ke wp-admin HNS IT Center (untuk generate WooCommerce API key)

---

## Tech Stack

| Kategori | Pilihan |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| UI Primitives | shadcn/ui |
| Client State | Zustand |
| Server State (client) | TanStack Query |
| Form | React Hook Form + Zod |
| Data Source | WooCommerce REST API v3 |
| Package Manager | pnpm |
| Testing | Vitest + Playwright |

Detail lengkap & alasan pemilihan → [`CLAUDE.md`](./CLAUDE.md) bagian 4.

---

## Struktur Folder (Ringkas)

```
src/
├── app/                     # Next.js App Router (routes)
├── features/                # Logika per fitur (product, cart, checkout, ...)
├── components/              # Komponen global reusable (ui/, layout/, shared/)
├── lib/                     # Utility, API client, validators
├── config/                  # Env validation, site config
├── types/                   # Type global (WooCommerce, dsb)
└── styles/                  # CSS tambahan
```

Detail penuh → [`docs/02-architecture.md`](./docs/02-architecture.md).

---

## Scripts

| Command | Fungsi |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Jalankan production build |
| `pnpm lint` | ESLint check |
| `pnpm typecheck` | TypeScript check |
| `pnpm format` | Format kode dengan Prettier |
| `pnpm test` | Unit + integration test (Vitest) |
| `pnpm test:watch` | Vitest dalam watch mode |
| `pnpm test:e2e` | E2E test (Playwright) |
| `pnpm env:check` | Validasi env vars |

---

## Dokumentasi

Peta lengkap dokumentasi ada di [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md).

**Untuk AI agent (Claude Code, Cursor, dll):**
File [`CLAUDE.md`](./CLAUDE.md) adalah entry point wajib. Semua agent HARUS membaca file ini + `docs/` yang relevan sebelum menulis kode.

**Untuk developer baru, baca urut:**
1. [`README.md`](./README.md) — file ini
2. [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md) — brief lengkap project
3. [`CLAUDE.md`](./CLAUDE.md) — aturan coding
4. [`docs/02-architecture.md`](./docs/02-architecture.md) — struktur & arsitektur
5. [`docs/06-coding-standards.md`](./docs/06-coding-standards.md) — coding standard

**Untuk stakeholder / owner, baca:**
1. [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md)
2. [`docs/01-business-context.md`](./docs/01-business-context.md)

---

## Contributing

Sebelum push, pastikan:

- [ ] `pnpm typecheck` lulus
- [ ] `pnpm lint` lulus
- [ ] `pnpm test` lulus
- [ ] Tidak ada `console.log`, `any`, atau credential di kode
- [ ] Commit message ikut Conventional Commits (`feat:`, `fix:`, `chore:`, ...)

Detail penuh → [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md) bagian 7 & 8 (Git Workflow & Definition of Done).

---

## Lisensi

Proprietary — PT. Sentral Berkat Teknologi. Tidak untuk didistribusikan.
