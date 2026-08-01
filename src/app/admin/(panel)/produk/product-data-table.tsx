"use client"

import { useActionState, useState, useTransition, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ArrowDown, ArrowUp, Edit, Pencil, Search, Trash2, TriangleAlert, Loader2 } from "lucide-react"

import { formatRupiah } from "@/lib/utils"
import { applyBulkCategoryAction, previewBulkCategoryAction, deleteProductAction } from "./actions"
import { EMPTY_BULK_APPLY, EMPTY_BULK_PREVIEW } from "./state"
import { QuickEditModal } from "./quick-edit-modal"
import type { ProductCategory } from "@/types/woocommerce"

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
  statusLabel: Record<string, string>
}

function SortIcon({ field, currentSort, currentOrder }: { field: string, currentSort: string, currentOrder: string }) {
  if (currentSort !== field) return <div className="w-4" /> // placeholder spacer
  if (currentOrder === "asc") return <ArrowUp className="h-4 w-4 text-green-500" />
  return <ArrowDown className="h-4 w-4 text-red-500" />
}

export function ProductDataTable({ products, categories, rawCategories, statusLabel }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Search
  const q = searchParams.get("q") || ""
  const [searchValue, setSearchValue] = useState(q)

  // Sort
  const currentSort = searchParams.get("sort") || "date"
  const currentOrder = searchParams.get("order") || "desc"

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Bulk Actions
  const [categoryId, setCategoryId] = useState("")
  const [mode, setMode] = useState<"add" | "remove">("add")

  // Modals
  const [quickEditProduct, setQuickEditProduct] = useState<BulkProductRow | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<BulkProductRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [previewState, previewAction, previewing] = useActionState(
    previewBulkCategoryAction,
    EMPTY_BULK_PREVIEW
  )
  const [applyState, applyAction, applying] = useActionState(
    applyBulkCategoryAction,
    EMPTY_BULK_APPLY
  )

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
      // Toggle order
      params.set("order", currentOrder === "asc" ? "desc" : "asc")
    } else {
      // New field, default to desc except for title/sku
      params.set("sort", field)
      params.set("order", field === "title" || field === "sku" ? "asc" : "desc")
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

  const ids = [...selected].join(",")

  const preview =
    previewState.preview &&
    previewState.preview.categoryId === Number(categoryId) &&
    previewState.preview.mode === mode &&
    previewState.preview.selected === selected.size
      ? previewState.preview
      : null

  const message = previewState.error ?? applyState.error

  return (
    <div className="space-y-4 relative">
      {/* Search Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary overflow-hidden">
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

      {message && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </p>
      )}
      {applyState.ok && !message && (
        <p className="rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
          {applyState.ok}
        </p>
      )}

      {/* Bulk Action Controls */}
      {selected.size > 0 && (
        <div className="space-y-2 rounded-xl border border-input bg-background p-3 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-semibold" htmlFor="bulk-category">
                Kategori untuk {selected.size} produk
              </label>
              <select
                id="bulk-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">— pilih kategori —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.path}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-semibold" htmlFor="bulk-mode">
                Perubahan
              </label>
              <select
                id="bulk-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value === "remove" ? "remove" : "add")}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="add">Tambahkan kategori</option>
                <option value="remove">Lepas kategori</option>
              </select>
            </div>
            <form action={previewAction}>
              <input type="hidden" name="productIds" value={ids} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <input type="hidden" name="mode" value={mode} />
              <button
                type="submit"
                disabled={previewing || categoryId === ""}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Lihat dampak
              </button>
            </form>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Batal
            </button>
          </div>

          {preview && (
            <div className="pt-2">
              <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">{preview.willChange} produk</span>{" "}
                  {preview.mode === "add" ? "akan mendapat" : "akan kehilangan"} kategori &quot;
                  {preview.categoryName}&quot;.
                </p>
                {preview.alreadyDone > 0 && <p>{preview.alreadyDone} produk sudah sesuai dan tidak disentuh.</p>}
                {preview.primaryBeingRemoved > 0 && (
                  <p className="flex items-start gap-2 text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Untuk {preview.primaryBeingRemoved} produk ini adalah kategori utamanya.
                  </p>
                )}
              </div>

              {preview.willChange > 0 && (
                <form action={applyAction} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="productIds" value={ids} />
                  <input type="hidden" name="categoryId" value={preview.categoryId} />
                  <input type="hidden" name="mode" value={preview.mode} />
                  <input type="hidden" name="acknowledgedChangeCount" value={preview.willChange} />
                  <button
                    type="submit"
                    disabled={applying}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
                  >
                    Terapkan ke {preview.willChange} produk
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-background overflow-x-auto shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-input"
                />
              </th>
              <th className="px-4 py-3 font-semibold w-12">Gambar</th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center gap-1">
                  Nama Produk
                  <SortIcon field="title" currentSort={currentSort} currentOrder={currentOrder} />
                </div>
              </th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("sku")}
              >
                <div className="flex items-center gap-1">
                  SKU
                  <SortIcon field="sku" currentSort={currentSort} currentOrder={currentOrder} />
                </div>
              </th>
              <th className="px-4 py-3 font-semibold">Stok</th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("price")}
              >
                <div className="flex items-center gap-1">
                  Harga
                  <SortIcon field="price" currentSort={currentSort} currentOrder={currentOrder} />
                </div>
              </th>
              <th className="px-4 py-3 font-semibold">Kategori</th>
              <th className="px-4 py-3 font-semibold">Brand</th>
              <th 
                className="px-4 py-3 font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center gap-1">
                  Tgl Publish
                  <SortIcon field="date" currentSort={currentSort} currentOrder={currentOrder} />
                </div>
              </th>
              <th className="px-4 py-3 font-semibold text-right">Aksi</th>
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
                <td className="px-4 py-3 align-middle max-w-[200px]">
                  <p className="font-medium text-foreground line-clamp-2" title={product.name}>
                    {product.name}
                  </p>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                    {statusLabel[product.status] ?? product.status}
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
                <td className="px-4 py-3 align-middle font-semibold text-foreground">
                  {formatRupiah(product.price)}
                </td>
                <td className="px-4 py-3 align-middle text-muted-foreground max-w-[150px] truncate" title={product.categories.map(c => c.name).join(", ")}>
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
                    <button
                      onClick={() => setQuickEditProduct(product)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Quick Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <Link
                      href={`/admin/produk/${product.id}`}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Edit Detail"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => setDeleteProduct(product)}
                      className="rounded p-1.5 text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Hapus Produk"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </div>
  )
}
