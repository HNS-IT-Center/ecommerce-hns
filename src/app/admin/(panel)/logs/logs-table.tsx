"use client"

import { useState, useTransition, useEffect } from "react"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Eye, Search, Loader2, X, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import type { DateRange } from "react-day-picker"
import { formatRupiah } from "@/lib/utils"
import { CalendarDateRangePicker } from "@/components/admin/date-range-picker"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ProductLog = {
  id: number
  userName: string
  productId: number
  productName: string
  action: string
  fieldAffected: string
  oldValue: string | null
  newValue: string | null
  createdAt: Date
}

type Props = {
  logs: ProductLog[]
  totalPages: number
  currentPage: number
  q: string
  sort: string
  order: string
  from: string
  to: string
  action: string
  availableActions: string[]
}

/**
 * Nama aksi disimpan sebagai konstanta huruf besar supaya mudah disaring, tapi
 * yang membacanya di layar adalah staf toko — jadi labelnya diterjemahkan.
 * Aksi yang belum punya terjemahan tampil apa adanya, bukan kosong.
 */
const ACTION_LABELS: Record<string, string> = {
  UPDATE_PRICE: "Update Harga",
  SYNC_PRICE: "Sinkron Harga (WooCommerce)",
  SYNC_IMPORT: "Import dari WooCommerce",
  EDIT_PRODUCT: "Edit Produk",
  QUICK_EDIT: "Quick Edit",
  UPLOAD_PRODUCTS: "Tambah Produk",
  DELETE: "Hapus Produk",
  BULK_STATUS: "Massal: Status",
  BULK_STOCK_STATUS: "Massal: Stok",
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

/** `YYYY-MM-DD` di zona waktu setempat — `toISOString()` menggeser tanggalnya. */
function toDateParam(date: Date) {
  return format(date, "yyyy-MM-dd")
}

/** Kebalikan `toDateParam`; nilai yang tak berbentuk tanggal diabaikan. */
function fromDateParam(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/**
 * Kepala tabel yang bisa diurutkan, berikut lebarnya.
 *
 * Harus sejalan dengan `SORTABLE_FIELDS` di `page.tsx` — halaman itu menolak
 * kolom di luar daftarnya, jadi kepala yang tidak terdaftar di sana akan
 * tampak bisa diklik tapi tidak mengubah apa pun.
 *
 * Lebarnya mengikat karena tabelnya memakai `table-fixed`; lihat catatan di
 * elemen `<table>` soal mengapa itu perlu.
 */
const SORTABLE_COLUMNS: Array<{ field: string; label: string; width: string }> = [
  { field: "createdAt", label: "Tanggal & Waktu", width: "w-[150px] xl:w-[170px]" },
  { field: "userName", label: "User", width: "w-[130px] xl:w-[150px]" },
  { field: "action", label: "Aksi", width: "w-[130px] xl:w-[150px]" },
  // Satu-satunya kolom tanpa lebar tetap: ia menyerap sisa ruang, sehingga
  // layar lebar dipakai untuk menampilkan nama produk lebih panjang alih-alih
  // menyisakan celah kosong di kanan tabel.
  { field: "productName", label: "Produk", width: "" },
  { field: "fieldAffected", label: "Field", width: "w-[120px] xl:w-[140px]" },
]

/**
 * Lebar terkecil sebelum tabel mulai menggulir mendatar.
 *
 * Jumlah lebar tetap di atas plus ruang layak untuk kolom Produk dan Detail.
 * Di bawah angka ini kolom akan saling menghimpit, jadi lebih baik tabelnya
 * digulir daripada isinya dipadatkan sampai tak terbaca.
 */
const TABLE_MIN_WIDTH = "min-w-[880px]"

/** Kelas padding sel — dipakai kepala maupun isi supaya kolomnya tetap lurus. */
const CELL_PADDING = "px-3 py-2.5 xl:px-4 xl:py-3"

/**
 * Tiga keadaan, tiga rupa: belum diurutkan (panah ganda pudar), menurun, dan
 * menaik. Warna hijau/merah sebelumnya dipakai untuk membedakan arah, tapi
 * merah di antarmuka ini berarti "kesalahan" atau "nilai lama" di tempat lain,
 * sehingga kolom yang sekadar diurutkan menurun tampak seperti peringatan.
 * Arah sudah dibedakan oleh bentuk panahnya, jadi keduanya cukup memakai warna
 * aksen yang sama.
 */
function SortIcon({ field, currentSort, currentOrder }: { field: string, currentSort: string, currentOrder: string }) {
  if (currentSort !== field) {
    return <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground/50" />
  }
  if (currentOrder === "asc") return <ChevronUp className="h-4 w-4 shrink-0 text-primary" />
  return <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
}

/**
 * Sepasang panel nilai lama dan nilai baru di dalam dialog detail.
 *
 * Bersebelahan mulai dari layar kecil ke atas, bertumpuk di bawahnya: dua
 * kolom pada lebar ponsel menyisakan ruang teks yang terlalu sempit untuk
 * nilai seperti daftar kategori atau alamat gambar.
 */
function ValueComparison({ oldValue, newValue }: { oldValue: string; newValue: string }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      <div className="bg-red-50/50 p-4">
        <span className="mb-2 block text-xs font-semibold text-red-600">Nilai Lama</span>
        {/*
          `break-all` menemani `whitespace-pre-wrap`: nilai log kerap berupa
          rentetan tanpa spasi (daftar alamat gambar, deretan id kategori) yang
          tidak punya titik patah alami, dan tanpa ini panel akan melebar
          melewati dialognya.
        */}
        <pre className="font-mono text-xs break-all whitespace-pre-wrap text-slate-700 sm:text-sm">
          {oldValue}
        </pre>
      </div>
      <div className="bg-green-50/50 p-4">
        <span className="mb-2 block text-xs font-semibold text-green-600">Nilai Baru</span>
        <pre className="font-mono text-xs break-all whitespace-pre-wrap text-slate-700 sm:text-sm">
          {newValue}
        </pre>
      </div>
    </div>
  )
}

function SortableHeader({
  field,
  label,
  width,
  currentSort,
  currentOrder,
  onSort,
}: {
  field: string
  label: string
  width: string
  currentSort: string
  currentOrder: string
  onSort: (field: string) => void
}) {
  const isActive = currentSort === field

  return (
    // `aria-sort` di `th`-nya, bukan di tombol — itu yang dibaca pembaca layar
    // saat menelusuri tabel, dan kolom tak terurut harus "none", bukan kosong.
    <th
      aria-sort={isActive ? (currentOrder === "asc" ? "ascending" : "descending") : "none"}
      className={`font-semibold ${width}`}
    >
      {/*
        Tombol sungguhan, bukan `th` ber-onClick seperti sebelumnya: yang lama
        tidak bisa dijangkau Tab maupun ditekan dengan Enter, jadi pengurutan
        hanya bisa dilakukan dengan tetikus. Tombolnya mengisi penuh sel supaya
        area kliknya tetap seluas kepala kolom.
      */}
      <button
        type="button"
        onClick={() => onSort(field)}
        title={`Urutkan berdasarkan ${label}`}
        className={`flex w-full items-center justify-between gap-1 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none ${CELL_PADDING}`}
      >
        <span className="truncate">{label}</span>
        <SortIcon field={field} currentSort={currentSort} currentOrder={currentOrder} />
      </button>
    </th>
  )
}

export function LogsTable({
  logs,
  totalPages,
  currentPage,
  q,
  sort,
  order,
  from,
  to,
  action,
  availableActions,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [searchValue, setSearchValue] = useState(q)
  const [selectedLog, setSelectedLog] = useState<ProductLog | null>(null)

  const dateRange: DateRange | undefined = fromDateParam(from)
    ? { from: fromDateParam(from), to: fromDateParam(to) }
    : undefined

  const hasActiveFilter = Boolean(q || from || to || action)

  /**
   * Semua penyaring bermuara ke URL, bukan ke state komponen. Dengan begitu
   * hasil pencarian bisa disalin-tempel ke orang lain, tombol kembali bekerja
   * seperti yang diharapkan, dan penomoran halaman di bawah — yang memang
   * membaca URL — ikut menyaring tanpa penanganan khusus.
   */
  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams)
    mutate(params)
    // Halaman 5 dari hasil lama hampir pasti di luar jangkauan hasil baru.
    params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleDateChange = (range: DateRange | undefined) => {
    updateParams((params) => {
      if (range?.from) params.set("from", toDateParam(range.from))
      else params.delete("from")

      // Rentang satu hari hanya mengisi `from`; `to` disamakan agar penyaring
      // di server tetap menerima batas akhir dan tidak berubah jadi terbuka.
      const end = range?.to ?? range?.from
      if (end) params.set("to", toDateParam(end))
      else params.delete("to")
    })
  }

  const handleActionChange = (value: string) => {
    updateParams((params) => {
      if (value) params.set("action", value)
      else params.delete("action")
    })
  }

  const handleResetFilters = () => {
    setSearchValue("")
    updateParams((params) => {
      params.delete("q")
      params.delete("from")
      params.delete("to")
      params.delete("action")
    })
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== q) {
        const params = new URLSearchParams(searchParams)
        if (searchValue) params.set("q", searchValue)
        else params.delete("q")
        params.delete("page") // Reset to page 1 on search
        
        startTransition(() => {
          router.push(`${pathname}?${params.toString()}`)
        })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchValue, q, pathname, router, searchParams])

  /**
   * Siklus tiga langkah: default → menurun → menaik → default.
   *
   * Menurun lebih dulu karena log hampir selalu dibaca dari yang terbaru, dan
   * langkah ketiga mengembalikan kolom ke keadaan tak terurut — tanpa itu
   * pengurutan sekali klik tidak bisa dibatalkan selain dengan menyunting URL.
   *
   * Berpindah kolom selalu mulai dari menurun lagi, bukan meneruskan arah
   * kolom sebelumnya, supaya arah yang berlaku selalu sesuai ikon yang baru
   * saja diklik.
   */
  const handleSort = (field: string) => {
    updateParams((params) => {
      if (sort !== field) {
        params.set("sort", field)
        params.set("order", "desc")
        return
      }

      if (order === "desc") {
        params.set("order", "asc")
        return
      }

      // Sudah menaik — putaran selesai, kembali ke urutan bawaan.
      params.delete("sort")
      params.delete("order")
    })
  }

  /**
   * Kendali khusus layar kecil: memilih kolom lewat daftar pilihan, bukan
   * dengan mengklik kepala tabel. Nilai kosong berarti kembali ke urutan
   * bawaan — padanan langkah ketiga pada siklus di atas.
   */
  const handleSortField = (field: string) => {
    updateParams((params) => {
      if (!field) {
        params.delete("sort")
        params.delete("order")
        return
      }
      params.set("sort", field)
      params.set("order", order || "desc")
    })
  }

  /**
   * Membalik arah tanpa ikut melepas kolomnya. Tombol arah di layar kecil
   * berdiri sendiri di sebelah pemilih kolom, jadi menekannya saat urutan
   * sedang menaik harus kembali ke menurun — bukan mengosongkan pilihan
   * seperti yang dilakukan siklus tiga langkah pada kepala tabel.
   */
  const handleToggleOrder = () => {
    if (!sort) return
    updateParams((params) => {
      params.set("sort", sort)
      params.set("order", order === "asc" ? "desc" : "asc")
    })
  }

  const getActionBadgeColor = (logAction: string) => {
    if (logAction.startsWith('BULK_')) return 'bg-orange-100 text-orange-800'
    switch(logAction) {
      case 'UPDATE_PRICE': return 'bg-blue-100 text-blue-800'
      case 'SYNC_PRICE': return 'bg-cyan-100 text-cyan-800'
      case 'SYNC_IMPORT': return 'bg-teal-100 text-teal-800'
      case 'EDIT_PRODUCT': return 'bg-amber-100 text-amber-800'
      case 'QUICK_EDIT': return 'bg-purple-100 text-purple-800'
      case 'UPLOAD_PRODUCTS': return 'bg-green-100 text-green-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const formatLogValue = (logAction: string, val: string | null) => {
    // String kosong pada harga berarti "tidak ada harga obral", bukan nol.
    if (val === null || val === "") return "-"
    if (logAction !== 'UPDATE_PRICE' && logAction !== 'SYNC_PRICE') return val

    const num = Number(val)
    if (!isNaN(num)) return formatRupiah(num)

    // Harga normal dan harga obral yang berubah bersamaan disimpan sebagai
    // objek JSON (`fieldAffected: "multiple"`), bukan satu angka. Tanpa
    // cabang ini nilainya tampil sebagai JSON mentah di kolom log.
    try {
      const parsed: unknown = JSON.parse(val)
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed as Record<string, unknown>)
          .map(([field, value]) => {
            const n = Number(value)
            const label = field === 'sale_price' ? 'Obral' : 'Normal'
            return `${label}: ${isNaN(n) || value === '' ? '-' : formatRupiah(n)}`
          })
          .join(', ')
      }
    } catch {
      // Bukan JSON — tampilkan apa adanya.
    }
    return val
  }

  return (
    <TooltipProvider delay={200}>
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden w-full sm:max-w-sm sm:flex-1">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Cari logs (produk, user, aksi)..."
            className="flex-1 bg-transparent py-2 text-sm outline-none"
          />
          {isPending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        <CalendarDateRangePicker
          value={dateRange}
          onChange={handleDateChange}
          placeholder="Semua tanggal"
          clearable
          className="w-full sm:w-auto"
        />

        <select
          value={action}
          onChange={(e) => handleActionChange(e.target.value)}
          aria-label="Saring berdasarkan aksi"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-[190px]"
        >
          <option value="">Semua Aksi</option>
          {availableActions.map((value) => (
            <option key={value} value={value}>
              {actionLabel(value)}
            </option>
          ))}
        </select>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-input px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Reset
          </button>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border border-border bg-background overflow-x-auto shadow-sm">
        {/*
          `table-fixed`, dan itu bukan sekadar rapi-rapi.

          Dengan tata letak otomatis bawaan HTML, lebar pada `<th>` hanya
          dianggap saran: browser menghitung ulang setiap kolom dari isi selnya.
          Akibatnya lebar kolom berubah setiap kali isi tabel berganti — pindah
          halaman atau mengubah penyaring membuat seluruh kolom bergeser, dan
          `truncate` pada sel pun tidak bekerja karena selnya tetap mengikuti
          teks di dalamnya.

          `table-fixed` membuat browser hanya membaca baris pertama dan
          mengabaikan isi sel sepenuhnya, sehingga lebarnya benar-benar terkunci.

          `min-w` menemani karena tabel berlebar tetap harus tetap muat: di
          layar sempit lebih baik tabelnya digulir mendatar (pembungkusnya sudah
          `overflow-x-auto`) daripada kolomnya dihimpit sampai tak terbaca.
        */}
        <table className={`w-full table-fixed text-left text-sm xl:text-[15px] ${TABLE_MIN_WIDTH}`}>
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {SORTABLE_COLUMNS.map((column) => (
                <SortableHeader
                  key={column.field}
                  field={column.field}
                  label={column.label}
                  width={column.width}
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                />
              ))}
              <th className={`w-[80px] text-right font-semibold ${CELL_PADDING}`}>Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {hasActiveFilter
                    ? "Tidak ada log yang cocok dengan filter ini."
                    : "Belum ada log aktivitas produk."}
                </td>
              </tr>
            )}
            {logs.map((log) => (
              // Tinggi minimum baris disamakan. Nama produk boleh turun ke baris
              // kedua, jadi tanpa lantai ini baris berjudul pendek jadi lebih
              // ceper daripada tetangganya dan daftarnya tampak bergelombang.
              <tr key={log.id} className="h-[60px] transition-colors hover:bg-muted/20">
                <td className={`align-middle whitespace-nowrap text-muted-foreground ${CELL_PADDING}`}>
                  {format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: id })}
                </td>
                <td className={`align-middle font-medium ${CELL_PADDING}`}>
                  <span className="line-clamp-2 break-words">{log.userName}</span>
                </td>
                <td className={`align-middle ${CELL_PADDING}`}>
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getActionBadgeColor(log.action)}`}>
                    {actionLabel(log.action)}
                  </span>
                </td>
                <td className={`align-middle ${CELL_PADDING}`} title={log.productName}>
                  {/*
                    `line-clamp-2` memotong di baris kedua, dan `break-words`
                    menjaga nama tanpa spasi — kode produk panjang kerap begitu —
                    tetap patah di dalam selnya alih-alih melebar melewatinya.
                  */}
                  <span className="line-clamp-2 break-words">{log.productName}</span>
                </td>
                <td className={`align-middle text-muted-foreground ${CELL_PADDING}`}>
                  <span className="line-clamp-2 break-words">{log.fieldAffected}</span>
                </td>
                <td className={`align-middle text-right ${CELL_PADDING}`}>
                  <Tooltip>
                    <TooltipTrigger render={
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition-colors hover:bg-slate-200"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Lihat Detail</span>
                      </button>
                    } />
                    <TooltipContent>Lihat Detail</TooltipContent>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4">
        {/*
          Kartu tidak punya kepala tabel untuk diklik, jadi pengurutan di layar
          kecil sebelumnya sama sekali tidak bisa dijangkau — urutannya selalu
          bawaan. Dua kendali ini memakai daftar kolom yang sama dengan tabel,
          sehingga pilihannya tidak bisa berbeda antar tampilan.
        */}
        {logs.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => handleSortField(e.target.value)}
              aria-label="Urutkan berdasarkan"
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Urutan Bawaan</option>
              {SORTABLE_COLUMNS.map((column) => (
                <option key={column.field} value={column.field}>
                  {column.label}
                </option>
              ))}
            </select>
            {sort && (
              <button
                type="button"
                onClick={handleToggleOrder}
                aria-label={order === "asc" ? "Urutkan menurun" : "Urutkan menaik"}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-xl border border-input px-3 text-sm transition-colors hover:bg-muted"
              >
                {order === "asc" ? (
                  <>
                    <ChevronUp className="h-4 w-4 text-primary" />
                    Menaik
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 text-primary" />
                    Menurun
                  </>
                )}
              </button>
            )}
          </div>
        )}
        {logs.length === 0 && (
          <div className="rounded-xl border border-border bg-background p-8 text-center text-muted-foreground shadow-sm">
            {hasActiveFilter
              ? "Tidak ada log yang cocok dengan filter ini."
              : "Belum ada log aktivitas produk."}
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="rounded-xl border border-border bg-background p-4 shadow-sm relative flex flex-col gap-3">
            <div className="flex justify-between items-start mb-1">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getActionBadgeColor(log.action)}`}>
                {actionLabel(log.action)}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: id })} WIB
              </span>
            </div>
            
            <div>
              <p className="font-semibold text-sm leading-tight text-foreground mb-1 line-clamp-2">
                {log.productName}
              </p>
              {/* `flex-wrap`: nama pengguna dan nama field yang panjang harus
                  turun baris, bukan meluber keluar kartu di layar sempit. */}
              <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
                <span>Oleh: <strong className="text-foreground">{log.userName}</strong></span>
                <span aria-hidden="true">•</span>
                <span className="break-all">Field: {log.fieldAffected}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border mt-1">
              <Tooltip>
                <TooltipTrigger render={
                  <button
                    onClick={() => setSelectedLog(log)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shadow-sm"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Lihat Detail</span>
                  </button>
                } />
                <TooltipContent>Lihat Detail</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        (() => {
          // Dibangun dari URL yang sedang aktif, bukan dari nol: menyalin
          // parameter satu per satu berarti setiap penyaring baru harus
          // diingat lagi di sini, dan yang terlupa akan diam-diam hilang
          // begitu halaman kedua dibuka.
          const buildUrl = (p: number) => {
            const params = new URLSearchParams(searchParams)
            params.set("page", String(p))
            return `/admin/logs?${params.toString()}`
          }

          let startPage = Math.max(1, currentPage - 2)
          const endPage = Math.min(totalPages, startPage + 4)
          if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4)
          }

          const pageNumbers = []
          for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i)
          }

          return (
            <div className="mt-6 flex items-center justify-center gap-1.5 text-sm">
              <Link
                href={buildUrl(Math.max(1, currentPage - 10))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input transition-colors ${
                  currentPage === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
                title="Mundur 10 Halaman"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Link>
              <Link
                href={buildUrl(Math.max(1, currentPage - 1))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input transition-colors ${
                  currentPage === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
                title="Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>

              {pageNumbers.map((p) => (
                <Link
                  key={p}
                  href={buildUrl(p)}
                  className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 transition-colors ${
                    p === currentPage
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {p}
                </Link>
              ))}

              <Link
                href={buildUrl(Math.min(totalPages, currentPage + 1))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input transition-colors ${
                  currentPage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
                title="Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href={buildUrl(Math.min(totalPages, currentPage + 10))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input transition-colors ${
                  currentPage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
                title="Maju 10 Halaman"
              >
                <ChevronsRight className="h-4 w-4" />
              </Link>
            </div>
          )
        })()
      )}

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        {/* Perubahan pada gambar atau kategori bisa memuat daftar panjang, jadi
            isinya dibatasi tinggi layar dan digulir di dalam dialog — tanpa itu
            tombol tutupnya bisa terdorong keluar pandangan. */}
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Log Aktivitas</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground block text-xs">User</span>
                  <span className="font-medium">{selectedLog.userName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Aksi</span>
                  <span className={`inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getActionBadgeColor(selectedLog.action)}`}>
                    {actionLabel(selectedLog.action)}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block text-xs">Waktu</span>
                  <span className="font-medium">{format(new Date(selectedLog.createdAt), "dd MMMM yyyy, HH:mm:ss", { locale: id })} WIB</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block text-xs">Produk</span>
                  <span className="font-medium">{selectedLog.productName} (ID: {selectedLog.productId})</span>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden mt-4">
                <div className="bg-muted px-4 py-2 font-semibold text-sm border-b">
                  Perubahan ({selectedLog.fieldAffected})
                </div>
                {selectedLog.fieldAffected === "multiple" ? (
                  <div className="flex flex-col divide-y divide-border">
                    {(() => {
                      try {
                        const oldObj = JSON.parse(selectedLog.oldValue || "{}");
                        const newObj = JSON.parse(selectedLog.newValue || "{}");
                        const asText = (value: unknown) =>
                          typeof value === 'object' && value !== null
                            ? JSON.stringify(value)
                            : String(value)

                        return Object.keys(oldObj).map((key) => (
                          <div key={key} className="flex flex-col">
                            <div className="bg-slate-50/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-border">
                              Field: {key}
                            </div>
                            <ValueComparison
                              oldValue={formatLogValue(selectedLog.action, asText(oldObj[key]))}
                              newValue={formatLogValue(selectedLog.action, asText(newObj[key]))}
                            />
                          </div>
                        ));
                      } catch {
                        return (
                          <ValueComparison
                            oldValue={formatLogValue(selectedLog.action, selectedLog.oldValue)}
                            newValue={formatLogValue(selectedLog.action, selectedLog.newValue)}
                          />
                        )
                      }
                    })()}
                  </div>
                ) : (
                  <ValueComparison
                    oldValue={formatLogValue(selectedLog.action, selectedLog.oldValue)}
                    newValue={formatLogValue(selectedLog.action, selectedLog.newValue)}
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
