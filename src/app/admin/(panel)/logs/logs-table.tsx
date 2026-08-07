"use client"

import { useState, useTransition, useEffect } from "react"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Eye, Search, Loader2, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import { formatRupiah } from "@/lib/utils"

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
}

function SortIcon({ field, currentSort, currentOrder }: { field: string, currentSort: string, currentOrder: string }) {
  if (currentSort !== field) return <ChevronsUpDown className="h-4 w-4 text-slate-400" />
  if (currentOrder === "asc") return <ChevronUp className="h-4 w-4 text-green-500" />
  return <ChevronDown className="h-4 w-4 text-red-500" />
}

export function LogsTable({ logs, totalPages, currentPage, q, sort, order }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [searchValue, setSearchValue] = useState(q)
  const [selectedLog, setSelectedLog] = useState<ProductLog | null>(null)

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

  const handleSort = (field: string) => {
    const params = new URLSearchParams(searchParams)
    if (sort === field) {
      if (order === "asc") {
        params.set("order", "desc")
      } else {
        params.delete("sort")
        params.delete("order")
      }
    } else {
      params.set("sort", field)
      params.set("order", "desc") // Default to desc for logs
    }
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('BULK_')) return 'bg-orange-100 text-orange-800'
    switch(action) {
      case 'UPDATE_PRICE': return 'bg-blue-100 text-blue-800'
      case 'QUICK_EDIT': return 'bg-purple-100 text-purple-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const formatLogValue = (action: string, val: string | null) => {
    if (!val) return "-"
    if (action === 'UPDATE_PRICE') {
      const num = Number(val)
      if (!isNaN(num)) return formatRupiah(num)

      // Perubahan harga reguler dan harga obral sekaligus disimpan sebagai
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
        // Bukan JSON — jatuh ke nilai apa adanya di bawah.
      }
      return val
    }
    return val
  }

  return (
    <TooltipProvider delay={200}>
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Cari logs (produk, user, aksi)..."
          className="flex-1 bg-transparent py-2 text-sm outline-none"
        />
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border border-border bg-background overflow-x-auto shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors w-[180px]"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center justify-between gap-1 group">
                  <span>Tanggal & Waktu</span>
                  <SortIcon field="createdAt" currentSort={sort} currentOrder={order} />
                </div>
              </th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors w-[150px]"
                onClick={() => handleSort("userName")}
              >
                <div className="flex items-center justify-between gap-1 group">
                  <span>User</span>
                  <SortIcon field="userName" currentSort={sort} currentOrder={order} />
                </div>
              </th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors w-[140px]"
                onClick={() => handleSort("action")}
              >
                <div className="flex items-center justify-between gap-1 group">
                  <span>Aksi</span>
                  <SortIcon field="action" currentSort={sort} currentOrder={order} />
                </div>
              </th>
              <th className="px-4 py-3 font-semibold w-[250px]">Produk</th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors w-[130px]"
                onClick={() => handleSort("fieldAffected")}
              >
                <div className="flex items-center justify-between gap-1 group">
                  <span>Field</span>
                  <SortIcon field="fieldAffected" currentSort={sort} currentOrder={order} />
                </div>
              </th>
              <th className="px-4 py-3 font-semibold text-right w-[80px]">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada log aktivitas produk.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 align-middle text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: id })}
                </td>
                <td className="px-4 py-3 align-middle font-medium">
                  {log.userName}
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getActionBadgeColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle max-w-[250px] truncate" title={log.productName}>
                  {log.productName}
                </td>
                <td className="px-4 py-3 align-middle text-muted-foreground">
                  {log.fieldAffected}
                </td>
                <td className="px-4 py-3 align-middle text-right">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4">
        {logs.length === 0 && (
          <div className="rounded-xl border border-border bg-background p-8 text-center text-muted-foreground shadow-sm">
            Belum ada log aktivitas produk.
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="rounded-xl border border-border bg-background p-4 shadow-sm relative flex flex-col gap-3">
            <div className="flex justify-between items-start mb-1">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getActionBadgeColor(log.action)}`}>
                {log.action}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: id })} WIB
              </span>
            </div>
            
            <div>
              <p className="font-semibold text-sm leading-tight text-foreground mb-1 line-clamp-2">
                {log.productName}
              </p>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>Oleh: <strong className="text-foreground">{log.userName}</strong></span>
                <span>•</span>
                <span>Field: {log.fieldAffected}</span>
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
          const buildUrl = (p: number) => {
            const params = new URLSearchParams()
            if (q) params.set("q", q)
            if (sort) params.set("sort", sort)
            if (order) params.set("order", order)
            params.set("page", String(p))
            return `/admin/logs?${params.toString()}`
          }

          let startPage = Math.max(1, currentPage - 2)
          let endPage = Math.min(totalPages, startPage + 4)
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Log Aktivitas</DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">User</span>
                  <span className="font-medium">{selectedLog.userName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Aksi</span>
                  <span className={`inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${getActionBadgeColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-xs">Waktu</span>
                  <span className="font-medium">{format(new Date(selectedLog.createdAt), "dd MMMM yyyy, HH:mm:ss", { locale: id })} WIB</span>
                </div>
                <div className="col-span-2">
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
                        return Object.keys(oldObj).map((key) => (
                          <div key={key} className="flex flex-col">
                            <div className="bg-slate-50/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-border">
                              Field: {key}
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-border">
                              <div className="p-4 bg-red-50/50">
                                <span className="text-xs font-semibold text-red-600 block mb-2">Nilai Lama</span>
                                <pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">
                                  {formatLogValue(selectedLog.action, typeof oldObj[key] === 'object' ? JSON.stringify(oldObj[key]) : String(oldObj[key]))}
                                </pre>
                              </div>
                              <div className="p-4 bg-green-50/50">
                                <span className="text-xs font-semibold text-green-600 block mb-2">Nilai Baru</span>
                                <pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">
                                  {formatLogValue(selectedLog.action, typeof newObj[key] === 'object' ? JSON.stringify(newObj[key]) : String(newObj[key]))}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ));
                      } catch (e) {
                        return (
                          <div className="grid grid-cols-2 divide-x divide-border">
                            <div className="p-4 bg-red-50/50">
                              <span className="text-xs font-semibold text-red-600 block mb-2">Nilai Lama</span>
                              <pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">
                                {formatLogValue(selectedLog.action, selectedLog.oldValue)}
                              </pre>
                            </div>
                            <div className="p-4 bg-green-50/50">
                              <span className="text-xs font-semibold text-green-600 block mb-2">Nilai Baru</span>
                              <pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">
                                {formatLogValue(selectedLog.action, selectedLog.newValue)}
                              </pre>
                            </div>
                          </div>
                        )
                      }
                    })()}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <div className="p-4 bg-red-50/50">
                      <span className="text-xs font-semibold text-red-600 block mb-2">Nilai Lama</span>
                      <pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">
                        {formatLogValue(selectedLog.action, selectedLog.oldValue)}
                      </pre>
                    </div>
                    <div className="p-4 bg-green-50/50">
                      <span className="text-xs font-semibold text-green-600 block mb-2">Nilai Baru</span>
                      <pre className="text-sm whitespace-pre-wrap font-mono text-slate-700">
                        {formatLogValue(selectedLog.action, selectedLog.newValue)}
                      </pre>
                    </div>
                  </div>
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
