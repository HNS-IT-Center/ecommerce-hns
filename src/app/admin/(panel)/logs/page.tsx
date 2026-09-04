import Link from "next/link"
import { getPrisma } from "@/lib/prisma/client"
import { requirePageView } from "@/lib/auth"
import { LogsTable } from "./logs-table"
import { PcBuildLogsTable, type PcBuildQuoteRow } from "./pc-build-logs-table"
import type { Prisma, ProductLog } from "@prisma/client"

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{
    q?: string
    page?: string
    sort?: string
    order?: string
    tab?: string
    from?: string
    to?: string
    action?: string
  }>
}

/**
 * Kolom yang boleh dipakai mengurutkan. Daftar ini harus sejalan dengan kepala
 * tabel yang bisa diklik di `logs-table.tsx`; nilainya masuk langsung ke
 * `orderBy` Prisma, jadi apa pun di luar daftar ini ditolak.
 */
const SORTABLE_FIELDS = ["createdAt", "userName", "action", "productName", "fieldAffected"]

/**
 * Menerjemahkan `YYYY-MM-DD` dari URL menjadi batas rentang waktu.
 *
 * Tanggal dari penyaring tidak membawa jam, sementara `createdAt` membawanya.
 * Batas akhir karena itu digeser ke detik terakhir hari itu — tanpa itu,
 * memilih satu hari yang sama untuk awal dan akhir hanya mencakup tepat pukul
 * 00:00:00 dan tabelnya tampak kosong padahal ada isinya.
 */
function parseDateBoundary(value: string | undefined, edge: "start" | "end"): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const parsed = new Date(
    edge === "start" ? `${value}T00:00:00` : `${value}T23:59:59.999`
  )
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default async function AdminLogsPage({ searchParams }: Props) {
  await requirePageView("logs")
  const { q, page, sort, order, tab, from, to, action } = await searchParams

  const currentTab =
    tab === "update-harga" ? "update-harga" : tab === "pc-build" ? "pc-build" : "produk"
  // `page` datang dari URL yang bisa diedit bebas. Tanpa penjagaan ini,
  // `?page=abc` menghasilkan NaN dan `?page=0` menghasilkan `skip` negatif —
  // keduanya membuat Prisma melempar error dan seluruh halaman gagal render.
  const parsedPage = Number(page)
  const requestedPage =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  // `sort` ikut masuk ke `orderBy` Prisma, jadi nilainya tidak boleh diteruskan
  // mentah dari URL: `?sort=kolomAsal` membuat Prisma melempar dan seluruh
  // halaman gagal render. Hanya kolom yang memang punya kepala tabel yang
  // diterima; selebihnya jatuh ke urutan bawaan.
  const activeSort = sort && SORTABLE_FIELDS.includes(sort) ? sort : ""
  const activeOrder = activeSort && (order === "asc" || order === "desc") ? order : ""

  // Yang dipakai bertanya ke basis data selalu terisi; yang dikirim ke tabel
  // adalah nilai mentah di atas. Keduanya dibedakan supaya tabel bisa tahu
  // kapan kolom benar-benar dipilih dan kapan hanya memakai urutan bawaan —
  // tanpa itu kolom Tanggal selamanya tampak terurut dan siklus tiga langkahnya
  // tidak pernah bisa kembali ke keadaan awal.
  const currentSort = activeSort || "createdAt"
  const currentOrder = activeOrder || "desc"

  const prisma = getPrisma()

  let logs: ProductLog[] = []
  let quotes: PcBuildQuoteRow[] = []
  let availableActions: string[] = []
  let totalItems = 0
  let currentPage = requestedPage
  const perPage = 25

  if (currentTab === "pc-build") {
    totalItems = await prisma.pcBuildQuote.count()

    // Minta halaman di luar jangkauan (mis. `?page=999`) dikembalikan ke
    // halaman terakhir yang ada, bukan tabel kosong tanpa penjelasan.
    currentPage = Math.min(requestedPage, Math.max(1, Math.ceil(totalItems / perPage)))

    const rows = await prisma.pcBuildQuote.findMany({
      orderBy: { updatedAt: "desc" },
      skip: (currentPage - 1) * perPage,
      take: perPage,
    })

    // Decimal & Json milik Prisma tidak bisa diserahkan apa adanya ke Client
    // Component — dinormalkan ke number/array dulu di sini.
    quotes = rows.map((row) => ({
      id: row.id,
      code: row.code,
      items: row.items as unknown as PcBuildQuoteRow["items"],
      total: Number(row.total),
      itemCount: row.itemCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  } else if (currentTab === "produk") {
    const fromDate = parseDateBoundary(from, "start")
    const toDate = parseDateBoundary(to, "end")

    const whereCondition: Prisma.ProductLogWhereInput = {}

    if (q) {
      whereCondition.OR = [
        { productName: { contains: q } },
        { userName: { contains: q } },
        { action: { contains: q } },
      ]
    }

    // Penyaring aksi memakai kecocokan persis, bukan `contains`: "UPDATE_PRICE"
    // dan "BULK_STATUS" tidak boleh saling menjaring, dan nilainya memang
    // selalu dipilih dari daftar yang dibangun dari isi tabel itu sendiri.
    if (action) whereCondition.action = action

    if (fromDate || toDate) {
      whereCondition.createdAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      }
    }

    // Daftar aksi dibangun dari isi tabel, bukan dari senarai tetap di kode.
    // Aksi baru yang ditambahkan nanti akan muncul sendiri di penyaring tanpa
    // ada yang perlu ingat memperbaruinya di sini. Sengaja tidak ikut
    // tersaring supaya pilihan lain tetap terlihat setelah satu aksi dipilih.
    const actionGroups = await prisma.productLog.groupBy({
      by: ["action"],
      orderBy: { action: "asc" },
    })
    availableActions = actionGroups.map((group) => group.action)

    totalItems = await prisma.productLog.count({ where: whereCondition })

    currentPage = Math.min(requestedPage, Math.max(1, Math.ceil(totalItems / perPage)))

    logs = await prisma.productLog.findMany({
      where: whereCondition,
      // `id` sebagai pemecah seri. Satu penyimpanan yang mengubah harga
      // sekaligus field lain menulis dua baris sekaligus dengan `createdAt`
      // yang sama persis; tanpa kunci kedua, urutan keduanya berubah-ubah
      // setiap kali halaman dimuat.
      orderBy: [{ [currentSort]: currentOrder }, { id: "desc" }],
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
          href={`/admin/logs?tab=update-harga`}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            currentTab === "update-harga"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          Update Harga Log
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
      ) : currentTab === "update-harga" ? (
        <div className="rounded-xl border border-border bg-background p-12 text-center text-muted-foreground shadow-sm flex flex-col items-center justify-center">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🚧</span>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Segera Hadir</h2>
          <p>
            Riwayat aktivitas harga — sinkronisasi Accurate, impor Sheet, dan penerapan harga
            per produk — sedang disiapkan.
          </p>
        </div>
      ) : (
        <LogsTable
          logs={logs}
          totalPages={totalPages}
          currentPage={currentPage}
          q={q || ""}
          sort={activeSort}
          order={activeOrder}
          from={from || ""}
          to={to || ""}
          action={action || ""}
          availableActions={availableActions}
        />
      )}
    </div>
  )
}
