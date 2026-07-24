import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { env } from "@/config/env"

// PENTING: hanya diimport dari Server Action / Route Handler, tidak pernah
// dari Client Component.
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Database belum dikonfigurasi — isi DATABASE_URL di .env.local lalu jalankan `npx prisma migrate dev`"
    )
    this.name = "DatabaseNotConfiguredError"
  }
}

// Simpan instance di globalThis waktu dev supaya hot-reload Next.js tidak
// bikin koneksi Prisma baru berkali-kali (pola standar Next.js + Prisma).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Prisma 7 tidak lagi konek langsung dari `url` di schema.prisma — runtime
// client wajib pakai driver adapter (di sini @prisma/adapter-mariadb, yang
// membungkus package `mariadb` asli).
function createPrismaClient(): PrismaClient {
  // @prisma/adapter-mariadb requires mariadb:// protocol, but Prisma schema uses mysql://
  let url = env.DATABASE_URL as string
  // Remove any surrounding quotes that might have been accidentally kept by env parsers
  url = url.replace(/^['"]|['"]$/g, "")
  // Replace mysql:// with mariadb://
  url = url.replace(/^mysql:\/\//, "mariadb://")
  
  const adapter = new PrismaMariaDb(url)
  return new PrismaClient({ adapter })
}

export function getPrisma(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new DatabaseNotConfiguredError()
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }

  return globalForPrisma.prisma
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL)
}
