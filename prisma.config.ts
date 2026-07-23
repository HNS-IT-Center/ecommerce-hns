import { defineConfig } from "prisma/config"

// Prisma CLI secara default baca `.env`, bukan `.env.local` (konvensi Next.js
// yang dipakai project ini) — load manual di sini supaya `DATABASE_URL` yang
// sama dipakai app Next.js juga kebaca oleh `prisma migrate`/`db seed`.
try {
  process.loadEnvFile(".env.local")
} catch {
  // .env.local belum ada (mis. di CI) — DATABASE_URL diisi lewat env asli
}

// Pakai process.env langsung (bukan helper `env()` dari prisma/config) supaya
// `prisma generate` tetap bisa jalan (cuma baca schema, tidak konek ke DB)
// walau DATABASE_URL belum diisi — `env()` bawaan Prisma throw kalau variabel
// benar-benar tidak ada, padahal generate tidak butuh koneksi nyata.
const DATABASE_URL_PLACEHOLDER = "mysql://user:password@localhost:3306/placeholder"

// Config ini cuma dipakai CLI Prisma (migrate/db seed/studio) — koneksi
// runtime PrismaClient (dipakai app Next.js) diatur terpisah lewat driver
// adapter di src/lib/prisma/client.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || DATABASE_URL_PLACEHOLDER,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})
