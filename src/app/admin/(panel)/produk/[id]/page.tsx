import { notFound } from "next/navigation"
import { getProductById } from "@/lib/api/woocommerce/products"
import { getAllCategories } from "@/lib/api/woocommerce/categories"
import { ProdukForm } from "../produk-form"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminProdukEditPage({ params }: Props) {
  const { id } = await params
  const productId = Number(id)

  const [product, categories] = await Promise.all([
    getProductById(productId),
    getAllCategories(),
  ])

  if (!product) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Edit Produk — {product.name}</h1>
      <div className="mt-6">
        <ProdukForm
          categories={categories}
          productId={product.id}
          defaultImages={product.images?.map((img) => ({ id: img.id, source_url: img.src }))}
          defaultValues={{
            name: product.name,
            description: product.description,
            shortDescription: product.short_description,
            regularPrice: product.regular_price,
            salePrice: product.sale_price,
            stockQuantity: product.stock_quantity ?? 0,
            status:
              product.status === "publish" || product.status === "private" ? product.status : "draft",
            categoryIds: product.categories?.map((c) => c.id) ?? [],
            attributes: (product.attributes ?? []).map((attr) => ({
              name: attr.name,
              value: attr.options[0] ?? "",
            })),
            imageIds: product.images?.map((img) => img.id) ?? [],
          }}
        />
      </div>
    </div>
  )
}
