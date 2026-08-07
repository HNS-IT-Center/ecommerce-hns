import { notFound } from "next/navigation"
import { getProductById, getProductAttributes, getProductVariations } from "@/lib/api/woocommerce/products"
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

  const isVariable = product.type === "variable"

  // Varian hanya ditarik untuk produk yang memang bervariasi — produk simple
  // tidak punya anak, dan query tambahan di tiap halaman edit tidak gratis.
  const variations = isVariable ? await getProductVariations(product.id) : []

  // Atribut pembeda varian dikumpulkan dari DUA sumber lalu digabung:
  //
  //   1. penanda `variation` di induk (diturunkan dari data, lihat db-mapper), dan
  //   2. atribut yang benar-benar dipakai varian-varian itu sendiri.
  //
  // Keduanya diperlukan. 85 induk warisan Woo tidak mencatat atribut apa pun di
  // barisnya sendiri, sehingga sumber (1) kosong dan daftar varian tampil hampa
  // seolah datanya hilang — padahal anak-anaknya punya WARNA lengkap. Sebaliknya
  // induk bisa saja mencantumkan atribut yang belum dipakai varian mana pun,
  // dan kolomnya tetap perlu ada supaya bisa diisi.
  const variationAttributes: string[] = []
  if (isVariable) {
    const seen = new Set<string>()
    const push = (name: string) => {
      const key = name.trim().toLowerCase()
      if (!name.trim() || seen.has(key)) return
      seen.add(key)
      variationAttributes.push(name)
    }

    for (const attr of product.attributes ?? []) {
      if (attr.variation) push(attr.name)
    }
    for (const variation of variations) {
      for (const attr of variation.attributes) push(attr.name)
    }
  }

  const variationAttributeKeys = new Set(
    variationAttributes.map((name) => name.trim().toLowerCase()),
  )

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
            type: isVariable ? "variable" : "simple",
            variationAttributes,
            variations: variations.map((variation) => ({
              id: variation.id,
              attributes: Object.fromEntries(
                variationAttributes.map((name) => [
                  name,
                  variation.attributes.find(
                    (a) => a.name.trim().toLowerCase() === name.trim().toLowerCase(),
                  )?.option ?? "",
                ]),
              ),
              sku: variation.sku ?? "",
              regularPrice: variation.regular_price ?? "",
              salePrice: variation.sale_price ?? "",
              stockStatus: variation.stock_status === "outofstock" ? "outofstock" : "instock",
              stockQuantity: variation.stock_quantity ?? undefined,
              imageUrl: variation.image?.src ?? "",
            })),
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
            // Atribut pembeda varian sudah punya editornya sendiri di tabel
            // varian. Kalau ikut tampil di daftar atribut spek, admin melihat
            // "WARNA" di dua tempat dan menyimpannya akan menimpa daftar
            // pilihan varian dengan satu nilai saja.
            attributes: (product.attributes ?? [])
              .filter((attr) => !variationAttributeKeys.has(attr.name.trim().toLowerCase()))
              .map((attr) => ({
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
