import Link from "next/link"
import { Plus } from "lucide-react"
import { getProductsPaginated } from "@/lib/api/woocommerce/products"
import { getCategoriesForAdmin } from "@/lib/api/woocommerce/categories"
import { ProductBulkList } from "./product-bulk-list"

type Props = {
  searchParams: Promise<{ q?: string; page?: string }>
}

const STATUS_LABEL: Record<string, string> = {
  publish: "Publish",
  draft: "Draft",
  private: "Private",
}

export default async function AdminProdukPage({ searchParams }: Props) {
  const { q, page } = await searchParams
  const currentPage = Number(page ?? 1)

  const [{ products, totalPages }, categories] = await Promise.all([
    getProductsPaginated({
      search: q,
      page: currentPage,
      perPage: 20,
      orderby: "date",
      order: "desc",
      // Draft & private wajib ikut tampil: produk baru dibuat sebagai draft, dan
      // kalau daftar ini menyaringnya, produk itu hilang begitu selesai disimpan.
      status: "any",
    }),
    getCategoriesForAdmin(),
  ])

  const rows = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku ?? "",
    status: product.status,
    price: Number(product.price || 0),
    image: product.images?.[0]?.src ?? null,
  }))

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

      <div className="mt-6">
        <ProductBulkList
          products={rows}
          categories={categories.map((c) => ({ id: c.id, path: c.path }))}
          statusLabel={STATUS_LABEL}
        />
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
