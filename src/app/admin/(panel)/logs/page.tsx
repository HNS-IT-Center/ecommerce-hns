import Link from "next/link"
import { getPrisma } from "@/lib/prisma/client"
import { LogsTable } from "./logs-table"
import { PcBuildLogsTable, type PcBuildQuoteRow } from "./pc-build-logs-table"
import type { ProductLog } from "@prisma/client"

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string; tab?: string }>
}

export default async function AdminLogsPage({ searchParams }: Props) {
  const { q, page, sort, order, tab } = await searchParams

  const currentTab =
    tab === "kategori" ? "kategori" : tab === "pc-build" ? "pc-build" : "produk"
  const currentPage = Number(page ?? 1)
  const currentSort = sort || "createdAt"
  const currentOrder = (order === "asc" || order === "desc") ? order : "desc"

  const prisma = getPrisma()

  let logs: ProductLog[] = []
  let quotes: PcBuildQuoteRow[] = []
  let totalItems = 0
  const perPage = 25

  if (currentTab === "pc-build") {
    totalItems = await prisma.pcBuildQuote.count()

    const rows = await prisma.pcBuildQuote.findMany({
      orderBy: { lastPrintedAt: "desc" },
      skip: (currentPage - 1) * perPage,
      take: perPage,
    })

    // Decimal & Json milik Prisma tidak bisa diserahkan apa adanya ke Client
    // Component — dinormalkan ke number/array dulu di sini.
    quotes = rows.map((row) => ({
      id: row.id,
      code: row.code,
      items: row.items as unknown as PcBuildQuoteRow["items"],
      subtotal: Number(row.subtotal),
      assemblyFee: Number(row.assemblyFee),
      total: Number(row.total),
      itemCount: row.itemCount,
      printCount: row.printCount,
      createdAt: row.createdAt,
      lastPrintedAt: row.lastPrintedAt,
    }))
  } else if (currentTab === "produk") {
    const whereCondition = q ? {
      OR: [
        { productName: { contains: q } },
        { userName: { contains: q } },
        { action: { contains: q } },
      ]
    } : {}

    totalItems = await prisma.productLog.count({ where: whereCondition })
    
    logs = await prisma.productLog.findMany({
      where: whereCondition,
      orderBy: { [currentSort]: currentOrder },
      skip: (currentPage - 1) * perPage,
      take: perPage,
    })
  }

  const totalPages = Math.ceil(totalItems / perPage)

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Aktivitas Logs</h1>
      </div>
      
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-border">
        <Link
          href={`/admin/logs?tab=produk`}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            currentTab === "produk" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          Produk Logs
        </Link>
        <Link
          href={`/admin/logs?tab=kategori`}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            currentTab === "kategori"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          Kategori Logs
        </Link>
        <Link
          href={`/admin/logs?tab=pc-build`}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            currentTab === "pc-build"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          PC Build Logs
        </Link>
      </div>

      {currentTab === "pc-build" ? (
        <PcBuildLogsTable
          quotes={quotes}
          totalPages={totalPages}
          currentPage={currentPage}
        />
      ) : currentTab === "kategori" ? (
        <div className="rounded-xl border border-border bg-background p-12 text-center text-muted-foreground shadow-sm flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🚧</span>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Coming Soon</h2>
          <p>Fitur log aktivitas untuk Kategori sedang dalam pengembangan.</p>
        </div>
      ) : (
        <LogsTable 
          logs={logs} 
          totalPages={totalPages}
          currentPage={currentPage}
          q={q || ""}
          sort={currentSort}
          order={currentOrder}
        />
      )}
    </div>
  )
}
