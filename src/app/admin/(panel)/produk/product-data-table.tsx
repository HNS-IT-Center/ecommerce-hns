"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ChevronDown, ChevronUp, ChevronsUpDown, Edit, Layers, Pencil, Search, Trash2, Loader2 } from "lucide-react"

import { formatRupiah } from "@/lib/utils"
import { parseRupiah } from "@/lib/utils"
import { deleteProductAction, updateProductPriceAction, bulkUpdateProductStatusAction } from "./actions"
import { QuickEditModal } from "./quick-edit-modal"
import type { Product, ProductCategory, ProductAttributeTaxonomy } from "@/types/woocommerce"

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
  /** "variable" = produk induk yang punya varian; harga tampil "mulai dari". */
  type: Product["type"]
  variationCount: number
  /** Produk WooCommerce apa adanya — dipakai Quick Edit untuk mengisi form. */
  rawProduct: Product
}

/**
 * Penanda produk bervariasi di daftar admin.
 *
 * Tanpa ini, produk induk terlihat sama persis dengan produk biasa — padahal
 * harganya "mulai dari", stoknya ditentukan varian, dan menyuntingnya ikut
 * memengaruhi seluruh anak. Jumlah varian ikut ditampilkan supaya staff tahu
 * seberapa besar dampaknya sebelum membuka form.
 */
function VariableBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-info/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-info">
      <Layers className="h-3 w-3" />
      {count > 0 ? `${count} Varian` : "Variable"}
    </span>
  )
}

/**
 * Kolom harga untuk produk bervariasi.
 *
 * Sengaja TIDAK bisa disunting inline. Induk produk bervariasi tidak punya
 * harga sendiri — angka yang tampil di sini adalah "mulai dari", hasil hitungan
 * dari varian termurah. Menulis harga ke induk lewat suntingan inline tidak
 * mengubah apa pun yang dilihat pembeli (storefront tetap membaca harga varian)
 * tapi meninggalkan angka di induk yang tidak sinkron dengan varian mana pun —
 * kerusakan senyap yang baru ketahuan jauh di kemudian hari.
 *
 * Jalur yang benar sudah ada: Quick Edit membawa tabel varian lengkap, jadi
 * tombol di sini mengarah ke sana alih-alih menawarkan input yang menyesatkan.
 */
function VariablePriceCell({
  product,
  onOpenQuickEdit,
  compact = false,
}: {
  product: BulkProductRow
  onOpenQuickEdit: () => void
  compact?: boolean
}) {
  const from = Number(product.price || 0)

  return (
    <Tooltip>
      <TooltipTrigger render={
        <button
          type="button"
          onClick={onOpenQuickEdit}
          className="group flex w-full flex-col items-start gap-0.5 rounded p-1 -m-1 text-left transition-colors hover:bg-muted/50"
        >
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Mulai dari
          </span>
          <span className={compact ? "text-sm font-bold" : "font-bold"}>
            {formatRupiah(from)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-info">
            <Layers className="h-3 w-3" />
            Atur per varian
          </span>
        </button>
      } />
      <TooltipContent>
        Harga produk ini ditentukan per varian. Klik untuk membukanya di Quick Edit.
      </TooltipContent>
    </Tooltip>
  )
}

type Props = {
  products: BulkProductRow[]
  categories: { id: number; path: string }[]
  rawCategories: ProductCategory[] // For QuickEditModal
  attributeOptions: ProductAttributeTaxonomy[] // For QuickEditModal
}

function SortIcon({ field, currentSort, currentOrder }: { field: string, currentSort: string, currentOrder: string }) {
  if (currentSort !== field) return <ChevronsUpDown className="h-4 w-4 text-slate-400" />
  if (currentOrder === "asc") return <ChevronUp className="h-4 w-4 text-green-500" />
  return <ChevronDown className="h-4 w-4 text-red-500" />
}

// `categories` sengaja TIDAK ikut di-destructure walau ada di `Props`: komponen
// ini memakai `rawCategories` (bentuk berpath) untuk seluruh keperluannya.
// Prop-nya dipertahankan di tipe karena pemanggil masih mengirimnya.
export function ProductDataTable({ products, rawCategories, attributeOptions }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Search
  const q = searchParams.get("q") || ""
  const [searchValue, setSearchValue] = useState(q)

  // Sort
  const statusFilter = searchParams.get("status_filter") || ""
  const typeFilter = searchParams.get("type_filter") || ""
  const currentSort = searchParams.get("sort") || "date"
  const currentOrder = searchParams.get("order") || "desc"

  // Inline Price Edit
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null)
  const [editingRegular, setEditingRegular] = useState("")
  const [editingSale, setEditingSale] = useState("")
  const [confirmPriceProduct, setConfirmPriceProduct] = useState<{
    id: number, 
    name: string, 
    oldRegular: number, 
    oldSale: number, 
    newRegular: number, 
    newSale: number | null
  } | null>(null)

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Modals
  const [quickEditProduct, setQuickEditProduct] = useState<BulkProductRow | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<BulkProductRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [bulkActionType, setBulkActionType] = useState("")
  const [confirmBulkAction, setConfirmBulkAction] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  /**
   * Mengubah satu parameter di URL dan mengembalikan daftar ke halaman 1.
   *
   * Dipakai bersama oleh pencarian dan kedua dropdown filter — ketiganya butuh
   * perlakuan yang sama persis, jadi tidak ada gunanya menduplikasi logikanya.
   *
   * Reset halaman itu wajib: kriteria baru hampir selalu memperkecil jumlah
   * hasil, dan bertahan di halaman 7 setelahnya menampilkan tabel kosong yang
   * terbaca seperti "tidak ada produk" padahal hasilnya ada di halaman awal.
   *
   * Dideklarasikan sebelum `useEffect` di bawah supaya efek pencarian bisa
   * memanggilnya tanpa mengakses binding yang belum terdefinisi.
   */
  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete("page")

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [searchParams, pathname, router]
  )

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== q) {
        handleFilterChange("q", searchValue)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchValue, q, handleFilterChange])

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

  const handleDelete = () => {
    if (!deleteProduct) return
    setIsDeleting(true)
    startTransition(async () => {
      const res = await deleteProductAction(deleteProduct.id)
      setIsDeleting(false)
      if (!res.error) {
        setDeleteProduct(null)
        router.refresh()
      } else {
        alert(res.error)
      }
    })
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

  const handleBulkAction = () => {
    if (!bulkActionType || selected.size === 0) return
    setIsBulkUpdating(true)
    const idsToUpdate = Array.from(selected)
    startTransition(async () => {
      const res = await bulkUpdateProductStatusAction(idsToUpdate, bulkActionType)
      setIsBulkUpdating(false)
      if (!res.error) {
        setConfirmBulkAction(false)
        setSelected(new Set())
        setBulkActionType("")
        router.refresh()
      } else {
        alert(res.error)
      }
    })
  }

  return (
    <TooltipProvider delay={200}>
      <div className="space-y-4 relative">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange("status_filter", e.target.value)}
          aria-label="Filter status produk"
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Semua Status</option>
          <option value="publish">Published</option>
          <option value="draft">Draft</option>
          <option value="private">Private</option>
          <option value="empty_stock">Stok Kosong</option>
        </select>

        {/* Tipe sengaja jadi dropdown sendiri, bukan opsi tambahan di dropdown
            status: keduanya dimensi berbeda, sehingga "Draft" + "Bervariasi"
            bisa dipakai bersamaan. Digabung jadi satu, memilih salah satu akan
            mematikan yang lain. */}
        <select
          value={typeFilter}
          onChange={(e) => handleFilterChange("type_filter", e.target.value)}
          aria-label="Filter tipe produk"
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Semua Tipe</option>
          <option value="variable">Produk Bervariasi</option>
          <option value="simple">Produk Simple</option>
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
                  {product.type === "variable" && (
                    <span className="mr-1.5 inline-block align-middle">
                      <VariableBadge count={product.variationCount} />
                    </span>
                  )}
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
                  {product.type === "variable" ? (
                    <VariablePriceCell
                      product={product}
                      onOpenQuickEdit={() => setQuickEditProduct(product)}
                    />
                  ) : editingPriceId === product.id ? (
                    <div className="flex flex-col gap-1.5 w-[140px]">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] text-muted-foreground uppercase">Normal</label>
                        <input 
                          type="text" 
                          autoFocus
                          value={editingRegular}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '')
                            setEditingRegular(raw === "" ? "" : formatRupiah(parseInt(raw)).replace('Rp', '').trim())
                          }}
                          className="w-full rounded border px-2 py-1 text-xs font-normal bg-background text-foreground"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] text-muted-foreground uppercase">Obral</label>
                        <input 
                          type="text" 
                          value={editingSale}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '')
                            setEditingSale(raw === "" ? "" : formatRupiah(parseInt(raw)).replace('Rp', '').trim())
                          }}
                          className="w-full rounded border px-2 py-1 text-xs font-normal bg-background text-foreground"
                        />
                      </div>
                      <div className="flex gap-1 mt-1">
                        <button 
                          className="flex-1 bg-primary text-primary-foreground text-[10px] py-1 rounded hover:bg-primary/90"
                          onClick={() => {
                            const parsedReg = parseRupiah(editingRegular)
                            const parsedSale = editingSale.trim() ? parseRupiah(editingSale) : null
                            if (parsedReg !== Number(product.rawProduct?.regular_price || 0) || parsedSale !== (product.rawProduct?.sale_price ? Number(product.rawProduct.sale_price) : null)) {
                              setConfirmPriceProduct({
                                id: product.id, 
                                name: product.name,
                                oldRegular: Number(product.rawProduct?.regular_price || 0),
                                oldSale: Number(product.rawProduct?.sale_price || 0),
                                newRegular: parsedReg,
                                newSale: parsedSale
                              })
                            }
                            setEditingPriceId(null)
                          }}
                        >
                          OK
                        </button>
                        <button 
                          className="flex-1 bg-muted text-muted-foreground text-[10px] py-1 rounded hover:bg-muted/80"
                          onClick={() => setEditingPriceId(null)}
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="cursor-pointer hover:bg-muted/50 p-1 -m-1 rounded transition-colors group flex items-center justify-between border-b border-dashed border-muted-foreground/50"
                      onClick={() => {
                        setEditingRegular(String(product.rawProduct?.regular_price || ""))
                        setEditingSale(String(product.rawProduct?.sale_price || ""))
                        setEditingPriceId(product.id)
                      }}
                      title="Klik untuk ubah harga"
                    >
                      <div className="flex flex-col">
                        {product.rawProduct?.sale_price ? (
                          <>
                            <span className="line-through text-muted-foreground text-[10px]">{formatRupiah(Number(product.rawProduct.regular_price))}</span>
                            <span className="font-bold text-green-600">{formatRupiah(Number(product.rawProduct.sale_price))}</span>
                          </>
                        ) : (
                          <span className="font-bold">{formatRupiah(Number(product.rawProduct?.regular_price || 0))}</span>
                        )}
                      </div>
                      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity shrink-0 ml-1" />
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
                  {product.type === "variable" && <VariableBadge count={product.variationCount} />}
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
                {product.type === "variable" ? (
                  <VariablePriceCell
                    product={product}
                    onOpenQuickEdit={() => setQuickEditProduct(product)}
                    compact
                  />
                ) : editingPriceId === product.id ? (
                  <div className="flex flex-col gap-1 mt-1">
                    <input 
                      type="text" 
                      placeholder="Normal"
                      value={editingRegular}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '')
                        setEditingRegular(raw === "" ? "" : formatRupiah(parseInt(raw)).replace('Rp', '').trim())
                      }}
                      className="w-full rounded border px-2 py-1 text-sm font-semibold bg-background text-foreground"
                    />
                    <input 
                      type="text" 
                      placeholder="Obral"
                      value={editingSale}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '')
                        setEditingSale(raw === "" ? "" : formatRupiah(parseInt(raw)).replace('Rp', '').trim())
                      }}
                      className="w-full rounded border px-2 py-1 text-sm font-semibold bg-background text-foreground"
                    />
                    <div className="flex gap-1 mt-1">
                      <button 
                        className="flex-1 bg-primary text-primary-foreground text-xs py-1 rounded"
                        onClick={() => {
                          const parsedReg = parseRupiah(editingRegular)
                          const parsedSale = editingSale.trim() ? parseRupiah(editingSale) : null
                          if (parsedReg !== Number(product.rawProduct?.regular_price || 0) || parsedSale !== (product.rawProduct?.sale_price ? Number(product.rawProduct.sale_price) : null)) {
                            setConfirmPriceProduct({
                              id: product.id, 
                              name: product.name,
                              oldRegular: Number(product.rawProduct?.regular_price || 0),
                              oldSale: Number(product.rawProduct?.sale_price || 0),
                              newRegular: parsedReg,
                              newSale: parsedSale
                            })
                          }
                          setEditingPriceId(null)
                        }}
                      >OK</button>
                      <button 
                        className="flex-1 bg-muted text-muted-foreground text-xs py-1 rounded"
                        onClick={() => setEditingPriceId(null)}
                      >Batal</button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="cursor-pointer inline-flex items-center justify-between border-b border-dashed border-muted-foreground/50 pb-0.5 group mt-1"
                    onClick={() => {
                      setEditingRegular(String(product.rawProduct?.regular_price || ""))
                      setEditingSale(String(product.rawProduct?.sale_price || ""))
                      setEditingPriceId(product.id)
                    }}
                    title="Klik untuk ubah harga"
                  >
                    <div className="flex flex-col">
                      {product.rawProduct?.sale_price ? (
                        <>
                          <span className="line-through text-muted-foreground text-[10px]">{formatRupiah(Number(product.rawProduct.regular_price))}</span>
                          <span className="font-bold text-green-600 text-sm">{formatRupiah(Number(product.rawProduct.sale_price))}</span>
                        </>
                      ) : (
                        <span className="font-bold text-foreground text-sm">{formatRupiah(Number(product.rawProduct?.regular_price || 0))}</span>
                      )}
                    </div>
                    <Pencil className="h-3 w-3 ml-2 opacity-50 group-hover:opacity-100 text-muted-foreground transition-opacity shrink-0" />
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
          attributeOptions={attributeOptions}
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
              <span className="block mb-4">Ubah harga untuk produk <strong>{confirmPriceProduct?.name}</strong>?</span>
              <span className="grid grid-cols-2 gap-4 text-sm">
                <span className="space-y-1 block">
                  <strong className="text-muted-foreground block">Harga Lama</strong>
                  <span className="block">Normal: {formatRupiah(confirmPriceProduct?.oldRegular || 0)}</span>
                  <span className="block">Obral: {confirmPriceProduct?.oldSale ? formatRupiah(confirmPriceProduct.oldSale) : "-"}</span>
                </span>
                <span className="space-y-1 block">
                  <strong className="text-primary block">Harga Baru</strong>
                  <span className="font-bold block">Normal: {formatRupiah(confirmPriceProduct?.newRegular || 0)}</span>
                  <span className="font-bold text-green-600 block">Obral: {confirmPriceProduct?.newSale ? formatRupiah(confirmPriceProduct.newSale) : "-"}</span>
                </span>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault()
                if (confirmPriceProduct) {
                  startTransition(async () => {
                    await updateProductPriceAction(confirmPriceProduct.id, confirmPriceProduct.newRegular, confirmPriceProduct.newSale)
                    setConfirmPriceProduct(null)
                  })
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
