import Link from "next/link"
import { getPrisma } from "@/lib/prisma/client"
import { requirePageView } from "@/lib/auth"
import { PRICE_ACTIONS } from "@/lib/logs/actions"
import { LogsTable } from "./logs-table"
import type { Prisma } from "@prisma/client"

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

  /**
   * Dua tab, keduanya membaca `product_logs`.
   *
   * Tab ketiga "PC Build Logs" dihapus 22 September 2026. Ia membaca
   * `pc_build_quotes` — tabel yang sama dengan halaman Quotation & Penjualan —
   * dan seluruh isinya sudah tertutup di sana, lengkap dengan pencarian,
   * saringan per sales & status, rekap bulanan, dan pembatalan status Terjual
   * yang tidak pernah ada di sini.
   *
   * Yang menentukan bukan cuma soal mubazir: kedua halaman itu dijaga KUNCI
   * IZIN BERBEDA (`logs` vs `quotation`). Selama tab ini ada, siapa pun yang
   * diberi izin Logs ikut melihat seluruh nama pelanggan, nama sales, dan nilai
   * transaksi tanpa pernah diberi izin `quotation` — pemisahan yang sengaja
   * dibuat jadi bocor lewat pintu samping.
   *
   * `?tab=pc-build` yang masih tersimpan di bookmark seseorang jatuh ke tab
   * Produk, bukan ke halaman kosong.
   */
  const currentTab = tab === "update-harga" ? "update-harga" : "produk"
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

  const perPage = 25

  /**
   * Dua tab, satu jalur query. Bedanya cuma satu: tab harga membatasi diri
   * pada `PRICE_ACTIONS`. Menyalin seluruh logikanya untuk perbedaan sekecil
   * itu berarti penyaring tanggal, urutan, dan penjepitan halaman harus
   * diperbaiki dua kali setiap kali salah satunya berubah.
   */
  const hanyaHarga = currentTab === "update-harga"

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
  //
  // Di tab harga, aksi yang dipilih tetap harus berada di dalam PRICE_ACTIONS.
  // Tanpa penyaringan itu, `?action=DELETE` yang diketik di alamat akan
  // menembus batas tab dan menampilkan penghapusan produk di riwayat harga.
  if (hanyaHarga) {
    whereCondition.action =
      action && PRICE_ACTIONS.includes(action) ? action : { in: PRICE_ACTIONS }
  } else if (action) {
    whereCondition.action = action
  }

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
  //
  // Di tab harga, pilihannya dibatasi ke aksi harga yang BENAR-BENAR ada
  // isinya — menawarkan aksi yang nol barisnya hanya mengundang klik yang
  // berakhir di tabel kosong.
  const actionGroups = await prisma.productLog.groupBy({
    by: ["action"],
    ...(hanyaHarga ? { where: { action: { in: PRICE_ACTIONS } } } : {}),
    orderBy: { action: "asc" },
  })
  const availableActions = actionGroups.map((group) => group.action)

  const totalItems = await prisma.productLog.count({ where: whereCondition })

  const currentPage = Math.min(requestedPage, Math.max(1, Math.ceil(totalItems / perPage)))

  const logs = await prisma.productLog.findMany({
    where: whereCondition,
    // `id` sebagai pemecah seri. Satu penyimpanan yang mengubah harga
    // sekaligus field lain menulis dua baris sekaligus dengan `createdAt`
    // yang sama persis; tanpa kunci kedua, urutan keduanya berubah-ubah
    // setiap kali halaman dimuat.
    orderBy: [{ [currentSort]: currentOrder }, { id: "desc" }],
    skip: (currentPage - 1) * perPage,
    take: perPage,
  })

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
      </div>

      {currentTab === "update-harga" && (
        <p className="mb-4 text-sm text-muted-foreground">
          Riwayat perubahan harga katalog — penerapan dari Accurate, penyuntingan manual, dan
          masuknya produk baru. Harga modal &amp; dealer tidak muncul di sini: keduanya angka
          internal yang disunting di tabel kerja, bukan harga yang dilihat pelanggan.
        </p>
      )}

      {/*
        Tabel yang sama dengan tab Produk Logs, bukan salinannya. Ia sudah
        memformat UPDATE_PRICE & SYNC_PRICE sebagai rupiah — termasuk kasus
        `multiple` yang menyimpan harga normal & obral sebagai JSON — dan sudah
        punya pencarian, urutan, penyaring tanggal, serta lencana berwarna per
        aksi. Yang membedakan kedua tab ada di query-nya.
      */}
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
    </div>
  )
}
