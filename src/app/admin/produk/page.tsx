import Link from "next/link"
import Image from "next/image"
import { Plus } from "lucide-react"
import { getProductsPaginated } from "@/lib/api/woocommerce/products"
import { formatRupiah } from "@/lib/utils"

type Props = {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function AdminProdukPage({ searchParams }: Props) {
  const { q, page } = await searchParams
  const currentPage = Number(page ?? 1)

  const { products, totalPages } = await getProductsPaginated({
    search: q,
    page: currentPage,
    perPage: 20,
    orderby: "date",
    order: "desc",
  })

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produk</h1>
        <Link
          href="/admin/produk/baru"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Produk Baru
        </Link>
      </div>

      <form className="mt-4">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Cari produk..."
          className="w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
        />
      </form>

      <div className="mt-6 space-y-2">
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">Tidak ada produk ditemukan.</p>
        )}
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/admin/produk/${product.id}`}
            className="flex items-center gap-4 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
              {product.images?.[0]?.src && (
                <Image src={product.images[0].src} alt={product.name} fill className="object-cover" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <h2 className="truncate text-sm font-semibold">{product.name}</h2>
              <p className="text-xs text-muted-foreground">
                SKU: {product.sku || "-"} · {product.status === "publish" ? "Publish" : "Draft"}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-sale-red">{formatRupiah(Number(product.price || 0))}</p>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {currentPage > 1 && (
            <Link
              href={`/admin/produk?${new URLSearchParams({ ...(q ? { q } : {}), page: String(currentPage - 1) })}`}
              className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted"
            >
              Sebelumnya
            </Link>
          )}
          <span className="px-2 text-muted-foreground">
            Halaman {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/admin/produk?${new URLSearchParams({ ...(q ? { q } : {}), page: String(currentPage + 1) })}`}
              className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted"
            >
              Berikutnya
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
