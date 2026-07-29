"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { TriangleAlert } from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import {
  EMPTY_BULK_APPLY,
  EMPTY_BULK_PREVIEW,
  applyBulkCategoryAction,
  previewBulkCategoryAction,
} from "./actions"

/**
 * Daftar produk dengan penetapan kategori massal.
 *
 * Memindahkan produk antar kategori satu per satu lewat form produk adalah
 * penghalang terbesar penataan ulang katalog — melebur dua kategori kembar saja
 * menyentuh puluhan produk. Layar ini membuatnya jadi satu operasi, dengan
 * dampaknya ditampilkan lebih dulu supaya tidak ada yang berubah diam-diam.
 *
 * Pilihan sengaja terbatas pada halaman yang sedang dilihat. Memilih lintas
 * halaman terdengar praktis, tapi berarti PIC menyetujui perubahan pada produk
 * yang tidak sedang dilihatnya.
 */

export type BulkProductRow = {
  id: number
  name: string
  sku: string
  status: string
  price: number
  image: string | null
}

type Props = {
  products: BulkProductRow[]
  categories: { id: number; path: string }[]
  statusLabel: Record<string, string>
}

export function ProductBulkList({ products, categories, statusLabel }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [categoryId, setCategoryId] = useState("")
  const [mode, setMode] = useState<"add" | "remove">("add")

  const [previewState, previewAction, previewing] = useActionState(
    previewBulkCategoryAction,
    EMPTY_BULK_PREVIEW
  )
  const [applyState, applyAction, applying] = useActionState(
    applyBulkCategoryAction,
    EMPTY_BULK_APPLY
  )

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

  // Dampak hanya ditampilkan kalau masih menggambarkan pilihan yang sekarang.
  const preview =
    previewState.preview &&
    previewState.preview.categoryId === Number(categoryId) &&
    previewState.preview.mode === mode &&
    previewState.preview.selected === selected.size
      ? previewState.preview
      : null

  const message = previewState.error ?? applyState.error

  return (
    <div className="space-y-3">
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

      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-input bg-muted/30 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-input"
            />
            Pilih semua di halaman ini
          </label>
          <span className="text-sm text-muted-foreground">{selected.size} dipilih</span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Bersihkan pilihan
            </button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="space-y-2 rounded-xl border border-input bg-background p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-semibold" htmlFor="bulk-category">
                Kategori
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
          </div>

          {preview && (
            <>
              <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">{preview.willChange} produk</span>{" "}
                  {preview.mode === "add" ? "akan mendapat" : "akan kehilangan"} kategori &quot;
                  {preview.categoryName}&quot;.
                </p>
                {preview.alreadyDone > 0 && (
                  <p>{preview.alreadyDone} produk sudah sesuai dan tidak disentuh.</p>
                )}
                {preview.missing > 0 && (
                  <p>{preview.missing} produk terpilih tidak ditemukan lagi.</p>
                )}
                {preview.primaryBeingRemoved > 0 && (
                  <p className="flex items-start gap-2 text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Untuk {preview.primaryBeingRemoved} produk ini adalah kategori utamanya.
                    Tetapkan kategori utama baru setelah dilepas.
                  </p>
                )}
                {preview.wouldBeLeftWithoutCategory > 0 && (
                  <p className="flex items-start gap-2 text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {preview.wouldBeLeftWithoutCategory} produk akan kehilangan kategori terakhirnya
                    dan tidak lagi bisa ditemukan lewat penjelajahan kategori.
                  </p>
                )}
                <p>Kaitan ke kategori lain tidak disentuh.</p>
              </div>

              {preview.willChange > 0 && (
                <form action={applyAction} className="flex flex-wrap gap-2">
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
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">Tidak ada produk ditemukan.</p>
        )}
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary"
          >
            <input
              type="checkbox"
              checked={selected.has(product.id)}
              onChange={() => toggle(product.id)}
              className="h-4 w-4 shrink-0 rounded border-input"
              aria-label={`Pilih ${product.name}`}
            />
            <Link href={`/admin/produk/${product.id}`} className="flex flex-1 items-center gap-4 overflow-hidden">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {product.image && (
                  <Image src={product.image} alt={product.name} fill className="object-cover" />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <h2 className="truncate text-sm font-semibold">{product.name}</h2>
                <p className="text-xs text-muted-foreground">
                  SKU: {product.sku || "-"} · {statusLabel[product.status] ?? product.status}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-sale-red">{formatRupiah(product.price)}</p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
