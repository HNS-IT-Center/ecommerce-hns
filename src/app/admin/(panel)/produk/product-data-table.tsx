"use client"

import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ChevronDown, ChevronUp, ChevronsUpDown, Edit, Pencil, Search, Trash2, TriangleAlert, Loader2, Check } from "lucide-react"

import { formatRupiah } from "@/lib/utils"
import { parseRupiah } from "@/lib/utils"
import { deleteProductAction, updateProductPriceAction, bulkUpdateProductStatusAction } from "./actions"
import { QuickEditModal } from "./quick-edit-modal"
import type { ProductCategory } from "@/types/woocommerce"

// Shadcn UI Tooltips
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Shadcn UI Alert Dialog (assuming it exists in this project)
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type BulkProductRow = {
  id: number
  name: string
  sku: string
  status: string
  price: number
  image: string | null
  stockStatus: string
  categories: { id: number; name: string }[]
  brands: { name: string }[]
  dateCreated: string | Date
  rawProduct: any
}

type Props = {
  products: BulkProductRow[]
  categories: { id: number; path: string }[]
  rawCategories: ProductCategory[] // For QuickEditModal
}

function SortIcon({ field, currentSort, currentOrder }: { field: string, currentSort: string, currentOrder: string }) {
  if (currentSort !== field) return <ChevronsUpDown className="h-4 w-4 text-slate-400" />
  if (currentOrder === "asc") return <ChevronUp className="h-4 w-4 text-green-500" />
  return <ChevronDown className="h-4 w-4 text-red-500" />
}

export function ProductDataTable({ products, categories, rawCategories }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Search
  const q = searchParams.get("q") || ""
  const [searchValue, setSearchValue] = useState(q)

  // Sort
  const statusFilter = searchParams.get("status_filter") || ""
  const currentSort = searchParams.get("sort") || "date"
  const currentOrder = searchParams.get("order") || "desc"

  // Inline Price Edit
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState("")
  const [confirmPriceProduct, setConfirmPriceProduct] = useState<{id: number, name: string, oldPrice: number, newPrice: number} | null>(null)

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Modals
  const [quickEditProduct, setQuickEditProduct] = useState<BulkProductRow | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<BulkProductRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [bulkActionType, setBulkActionType] = useState("")
  const [confirmBulkAction, setConfirmBulkAction] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== q) {
        handleSearch(searchValue)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchValue, q])

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set("q", value)
    else params.delete("q")
    params.delete("page") // Reset to page 1 on search
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleSort = (field: string) => {
    const params = new URLSearchParams(searchParams)
    if (currentSort === field) {
      if (currentOrder === "asc") {
        params.set("order", "desc")
      } else {
        // Third click: return to default
        params.delete("sort")
        params.delete("order")
      }
    } else {
      // New field, default to asc
      params.set("sort", field)
      params.set("order", "asc")
    }
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleDelete = async () => {
    if (!deleteProduct) return
    setIsDeleting(true)
    const res = await deleteProductAction(deleteProduct.id)
    setIsDeleting(false)
    if (!res.error) {
      setDeleteProduct(null)
    } else {
      alert(res.error)
    }
  }

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allOnPageSelected = products.length > 0 && products.every((p) => selected.has(p.id))
  const toggleAll = () =>
    setSelected(allOnPageSelected ? new Set() : new Set(products.map((p) => p.id)))

  const ids = Array.from(selected).join(",")

  const handleBulkAction = async () => {
    if (!bulkActionType || selected.size === 0) return
    setIsBulkUpdating(true)
    const idsToUpdate = Array.from(selected)
    const res = await bulkUpdateProductStatusAction(idsToUpdate, bulkActionType)
    setIsBulkUpdating(false)
    if (!res.error) {
      setConfirmBulkAction(false)
      setSelected(new Set())
      setBulkActionType("")
    } else {
      alert(res.error)
    }
  }

  return (
    <TooltipProvider delay={200}>
      <div className="space-y-4 relative">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams)
            if (e.target.value) params.set("status_filter", e.target.value)
            else params.delete("status_filter")
            params.delete("page")
            startTransition(() => {
              router.push(`${pathname}?${params.toString()}`)
            })
          }}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Semua Status</option>
          <option value="publish">Published</option>
          <option value="draft">Draft</option>
          <option value="private">Private</option>
          <option value="empty_stock">Stok Kosong</option>
        </select>

        <div className="flex-1 flex items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Cari produk..."
            className="flex-1 bg-transparent py-2 text-sm outline-none"
          />
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Bulk Action Controls */}
      {selected.size > 0 && (
        <div className="space-y-2 rounded-xl border border-input bg-background p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold" htmlFor="bulk-action">
              Terapkan pada {selected.size} produk terpilih:
            </label>
            <select
              id="bulk-action"
              value={bulkActionType}
              onChange={(e) => setBulkActionType(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            >
              <option value="">— pilih aksi —</option>
              <option value="publish">Jadikan Publish</option>
              <option value="draft">Jadikan Draft</option>
              <option value="private">Jadikan Private</option>
              <option value="outofstock">Jadikan Stok Habis</option>
              <option value="instock">Jadikan Stok Tersedia</option>
            </select>
            
            <button
              type="button"
              onClick={() => setConfirmBulkAction(true)}
              disabled={bulkActionType === ""}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 transition-colors hover:bg-primary/90"
            >
              Terapkan
            </button>
            
            <button
              type="button"
              onClick={() => {
                setSelected(new Set())
                setBulkActionType("")
              }}
              className="rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border border-border bg-background overflow-x-auto shadow-sm">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="w-[50px] px-4 py-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-input"
                />
              </th>
              <th className="px-4 py-3 font-semibold w-[70px]">Gambar</th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors w-[220px]"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center justify-between gap-1 group">
                  <span>Nama Produk</span>
                  <SortIcon field="title" currentSort={currentSort} currentOrder={currentOrder} />
                </div>
              </th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors w-[100px]"
                onClick={() => handleSort("sku")}
              >
                <div className="flex items-center justify-between gap-1 group">
                  <span>SKU</span>
                  <SortIcon field="sku" currentSort={currentSort} currentOrder={currentOrder} />
                </div>
              </th>
              <th className="px-4 py-3 font-semibold w-[90px]">Stok</th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors w-[130px]"
                onClick={() => handleSort("price")}
              >
                <div className="flex items-center justify-between gap-1 group">
                  <span>Harga</span>
                  <SortIcon field="price" currentSort={currentSort} currentOrder={currentOrder} />
                </div>
              </th>
              <th className="px-4 py-3 font-semibold w-[160px]">Kategori</th>
              <th className="px-4 py-3 font-semibold w-[120px]">Brand</th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors w-[120px]"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center justify-between gap-1 group">
                  <span>Tgl Publish</span>
                  <SortIcon field="date" currentSort={currentSort} currentOrder={currentOrder} />
                </div>
              </th>
              <th className="px-4 py-3 font-semibold text-right w-[100px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  Tidak ada produk ditemukan.
                </td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 align-middle">
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => toggle(product.id)}
                    className="h-4 w-4 rounded border-input"
                  />
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted border border-border relative">
                    {product.image ? (
                      <Image src={product.image} alt={product.name} fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No img</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 align-middle whitespace-normal break-words">
                  <p className="font-medium text-foreground text-xs leading-tight mb-1">
                    {product.name}
                  </p>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                    product.status === 'publish' ? 'bg-green-100 text-green-800' :
                    product.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                    product.status === 'private' ? 'bg-slate-100 text-slate-800' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {product.status}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle text-muted-foreground">
                  {product.sku || "-"}
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    product.stockStatus === 'instock' ? 'bg-brand-green/10 text-brand-green' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {product.stockStatus === 'instock' ? 'Tersedia' : 'Habis'}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle font-semibold text-foreground text-xs">
                  {editingPriceId === product.id ? (
                    <div className="flex flex-col gap-1">
                      <input 
                        type="text" 
                        autoFocus
                        value={editingPriceValue}
                        onChange={(e) => setEditingPriceValue(formatRupiah(parseRupiah(e.target.value)).replace('Rp', '').trim())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setConfirmPriceProduct({
                              id: product.id, 
                              name: product.name,
                              oldPrice: product.price,
                              newPrice: parseRupiah(editingPriceValue)
                            })
                            setEditingPriceId(null)
                          } else if (e.key === 'Escape') {
                            setEditingPriceId(null)
                          }
                        }}
                        onBlur={() => {
                           const parsed = parseRupiah(editingPriceValue)
                           if (parsed !== product.price) {
                             setConfirmPriceProduct({
                               id: product.id, 
                               name: product.name,
                               oldPrice: product.price,
                               newPrice: parsed
                             })
                           }
                           setEditingPriceId(null)
                        }}
                        className="w-full rounded border px-2 py-1 text-xs font-normal bg-background text-foreground"
                      />
                      <span className="text-[9px] text-muted-foreground font-normal">Tekan Enter untuk simpan</span>
                    </div>
                  ) : (
                    <div 
                      className="cursor-pointer hover:bg-muted/50 p-1 -m-1 rounded transition-colors group flex items-center justify-between border-b border-dashed border-muted-foreground/50"
                      onClick={() => {
                        setEditingPriceValue(String(product.price))
                        setEditingPriceId(product.id)
                      }}
                      title="Klik untuk ubah harga"
                    >
                      {formatRupiah(product.price)}
                      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-middle text-muted-foreground text-xs whitespace-normal break-words">
                  {product.categories.map(c => c.name).join(", ") || "-"}
                </td>
                <td className="px-4 py-3 align-middle text-muted-foreground">
                  {product.brands.map(b => b.name).join(", ") || "-"}
                </td>
                <td className="px-4 py-3 align-middle text-muted-foreground whitespace-nowrap">
                  {new Date(product.dateCreated).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td className="px-4 py-3 align-middle text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger render={
                        <button
                          onClick={() => setQuickEditProduct(product)}
                          className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      } />
                      <TooltipContent>Quick Edit</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger render={
                        <Link
                          href={`/admin/produk/${product.id}`}
                          className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      } />
                      <TooltipContent>Edit Detail</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger render={
                        <button
                          onClick={() => setDeleteProduct(product)}
                          className="flex items-center justify-center h-8 w-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      } />
                      <TooltipContent>Hapus Produk</TooltipContent>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4">
        {products.length === 0 && (
          <div className="rounded-xl border border-border bg-background p-8 text-center text-muted-foreground shadow-sm">
            Tidak ada produk ditemukan.
          </div>
        )}
        {products.map((product) => (
          <div key={product.id} className="rounded-xl border border-border bg-background p-4 shadow-sm relative flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted border border-border relative">
                {product.image ? (
                  <Image src={product.image} alt={product.name} fill sizes="64px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No img</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm leading-tight mb-1">
                  {product.name}
                </p>
                <div className="flex flex-wrap gap-1.5 items-center mb-1">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                    product.status === 'publish' ? 'bg-green-100 text-green-800' :
                    product.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                    product.status === 'private' ? 'bg-slate-100 text-slate-800' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {product.status}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    product.stockStatus === 'instock' ? 'bg-brand-green/10 text-brand-green' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {product.stockStatus === 'instock' ? 'Tersedia' : 'Habis'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  SKU: {product.sku || "-"}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="flex-1 max-w-[150px]">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Harga</span>
                {editingPriceId === product.id ? (
                  <div className="flex flex-col gap-1">
                    <input 
                      type="text" 
                      autoFocus
                      value={editingPriceValue}
                      onChange={(e) => setEditingPriceValue(formatRupiah(parseRupiah(e.target.value)).replace('Rp', '').trim())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setConfirmPriceProduct({
                            id: product.id, 
                            name: product.name,
                            oldPrice: product.price,
                            newPrice: parseRupiah(editingPriceValue)
                          })
                          setEditingPriceId(null)
                        } else if (e.key === 'Escape') {
                          setEditingPriceId(null)
                        }
                      }}
                      onBlur={() => {
                         const parsed = parseRupiah(editingPriceValue)
                         if (parsed !== product.price) {
                           setConfirmPriceProduct({
                             id: product.id, 
                             name: product.name,
                             oldPrice: product.price,
                             newPrice: parsed
                           })
                         }
                         setEditingPriceId(null)
                      }}
                      className="w-full rounded border px-2 py-1 text-sm font-semibold bg-background text-foreground"
                    />
                  </div>
                ) : (
                  <div 
                    className="cursor-pointer inline-flex items-center justify-between border-b border-dashed border-muted-foreground/50 pb-0.5 group"
                    onClick={() => {
                      setEditingPriceValue(String(product.price))
                      setEditingPriceId(product.id)
                    }}
                    title="Klik untuk ubah harga"
                  >
                    <span className="font-bold text-foreground text-sm">{formatRupiah(product.price)}</span>
                    <Pencil className="h-3 w-3 ml-2 opacity-50 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger render={
                    <button
                      onClick={() => setQuickEditProduct(product)}
                      className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  } />
                  <TooltipContent>Quick Edit</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger render={
                    <Link
                      href={`/admin/produk/${product.id}`}
                      className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shadow-sm"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                  } />
                  <TooltipContent>Edit Detail</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger render={
                    <button
                      onClick={() => setDeleteProduct(product)}
                      className="flex items-center justify-center h-8 w-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors shadow-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  } />
                  <TooltipContent>Hapus Produk</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        ))}
      </div>

      {quickEditProduct && (
        <QuickEditModal
          product={quickEditProduct}
          categories={rawCategories}
          onClose={() => setQuickEditProduct(null)}
        />
      )}

      {/* Shadcn UI Delete Dialog */}
      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan. Produk <strong>{deleteProduct?.name}</strong> akan dihapus permanen dari database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Price Edit Dialog */}
      <AlertDialog open={!!confirmPriceProduct} onOpenChange={(open) => !open && setConfirmPriceProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Perubahan Harga</AlertDialogTitle>
            <AlertDialogDescription>
              Ubah harga reguler untuk produk <strong>{confirmPriceProduct?.name}</strong>?
              <br/><br/>
              Harga Lama: <span className="line-through">{formatRupiah(confirmPriceProduct?.oldPrice || 0)}</span>
              <br/>
              Harga Baru: <span className="font-bold text-green-600">{formatRupiah(confirmPriceProduct?.newPrice || 0)}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async (e) => {
                e.preventDefault()
                if (confirmPriceProduct) {
                  await updateProductPriceAction(confirmPriceProduct.id, confirmPriceProduct.newPrice)
                  setConfirmPriceProduct(null)
                }
              }}
            >
              Simpan Harga
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Bulk Action Dialog */}
      <AlertDialog open={confirmBulkAction} onOpenChange={setConfirmBulkAction}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Aksi Massal</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menerapkan <strong>{bulkActionType}</strong> pada {selected.size} produk yang dipilih?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkUpdating}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault()
                handleBulkAction()
              }}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Ya, Terapkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  )
}
