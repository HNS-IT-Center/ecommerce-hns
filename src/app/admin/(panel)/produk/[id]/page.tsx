import { notFound } from "next/navigation"
import { getProductById, getProductAttributes } from "@/lib/api/woocommerce/products"
import { getAllCategories } from "@/lib/api/woocommerce/categories"
import { getBrands } from "@/lib/api/woocommerce/brands"
import { ProdukForm } from "../produk-form"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminProdukEditPage({ params }: Props) {
  const { id } = await params
  const productId = Number(id)

  const [product, categories, attributeOptions, brands] = await Promise.all([
    getProductById(productId),
    getAllCategories(),
    getProductAttributes(),
    getBrands(),
  ])

  if (!product) notFound()

  const existingImages = product.images?.map((img) => ({
    id: `existing-${img.id}`,
    previewUrl: img.src,
    uploadedUrl: img.src,
  }))

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Edit Produk — {product.name}</h1>
      <div className="mt-6">
        <ProdukForm
          categories={categories}
          attributeOptions={attributeOptions}
          brands={brands}
          productId={product.id}
          defaultImages={existingImages}
          defaultValues={{
            name: product.name,
            description: product.description,
            shortDescription: product.short_description,
            regularPrice: product.regular_price,
            salePrice: product.sale_price,
            // <input type="date"> hanya menerima YYYY-MM-DD.
            salePriceDateEnd: product.date_on_sale_to_gmt
              ? product.date_on_sale_to_gmt.split("T")[0]
              : "",
            stockQuantity: product.stock_quantity ?? undefined,
            stockStatus: product.stock_status === "outofstock" ? "outofstock" : "instock",
            status:
              product.status === "publish" || product.status === "private" ? product.status : "draft",
            categoryIds: product.categories?.map((c) => c.id) ?? [],
            attributes: (product.attributes ?? []).map((attr) => ({
              name: attr.name,
              value: attr.options[0] ?? "",
            })),
            imageIds: existingImages?.map((img) => img.id) ?? [],
            videoUrl: product.video_url ?? "",
            brand: product.brands?.[0]?.name ?? "",
          }}
        />
      </div>
    </div>
  )
}
