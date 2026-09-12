import { NextRequest, NextResponse } from "next/server"
import { getProductById, getProductSlugBySku } from "@/lib/api/woocommerce/products"

/**
 * Menukar identitas hasil pemindaian menjadi slug halaman produk.
 *
 * Dipakai tombol scan di kolom pencarian. Ada dua bentuk identitas yang bisa
 * keluar dari sebuah stiker:
 *
 *   `?id=34394`   — dari QR produk, yang isinya tautan pendek `/p/<id>`.
 *   `?sku=ABC123` — dari barcode SKU.
 *
 * **Kenapa tidak langsung diarahkan ke `/p/<id>` saja?** Karena `/p/[id]` itu
 * Route Handler yang menjawab dengan redirect 301, bukan sebuah page. Menyuruh
 * router klien Next menuju ke sana berarti bergantung pada penanganan redirect
 * di tengah navigasi RSC — dan yang lebih penting, halaman pemindai kehilangan
 * kesempatan memberi tahu "produk tidak ditemukan". Dengan menukar identitas
 * lebih dulu, pemindai bisa menampilkan pesannya sendiri dan kameranya tetap
 * menyala untuk percobaan berikutnya.
 *
 * Slug dikembalikan apa adanya; pemanggilnya yang menyusun path dan meng-encode.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const rawId = params.get("id")
  const rawSku = params.get("sku")

  try {
    if (rawId !== null) {
      const id = Number(rawId)
      if (!Number.isSafeInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Parameter id tidak valid" }, { status: 400 })
      }

      // `getProductById` mencari lewat `wooId` — nomor yang sama dengan yang
      // dipakai QR produk dan tautan pendek `/p/<id>`. Lihat db-mapper.ts,
      // tempat `id` pada DTO dipetakan dari `wooId`.
      const product = await getProductById(id)
      if (!product) {
        return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 })
      }

      return NextResponse.json({
        slug: product.slug,
        name: product.name,
        variationSku: null,
      })
    }

    if (rawSku !== null) {
      const sku = rawSku.trim()
      if (!sku) {
        return NextResponse.json({ error: "Parameter sku kosong" }, { status: 400 })
      }

      const found = await getProductSlugBySku(sku)
      if (!found) {
        return NextResponse.json({ error: "SKU tidak ditemukan" }, { status: 404 })
      }

      return NextResponse.json(found)
    }

    return NextResponse.json({ error: "Butuh parameter id atau sku" }, { status: 400 })
  } catch (error) {
    console.error("Resolve produk gagal:", error)
    return NextResponse.json({ error: "Gagal menemukan produk" }, { status: 500 })
  }
}
