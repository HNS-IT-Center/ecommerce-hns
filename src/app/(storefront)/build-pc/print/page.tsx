import { getPrisma } from "@/lib/prisma/client"
import Image from "next/image"
import { formatRupiah } from "@/lib/utils"
import { PrintClientComponent } from "./print-client-component"

export const metadata = {
  title: 'Cetak Rakitan PC - HNS IT Center',
}

export default async function PrintPcBuilderPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const itemsParam = params.items as string
  if (!itemsParam) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Error: Tidak ada data komponen yang dikirim.
      </div>
    )
  }

  // Parse items
  const items = itemsParam.split(",").map(str => {
    const [id, qty] = str.split(":")
    return { id: Number(id), quantity: Number(qty) }
  }).filter(i => !isNaN(i.id) && !isNaN(i.quantity))

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Error: Format data tidak valid.
      </div>
    )
  }

  const prisma = getPrisma()
  const productIds = items.map(i => i.id)

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      regularPrice: true,
      salePrice: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true }
      }
    }
  })

  // Map to quantity and calculate total
  const selectedItems = items.map(item => {
    const product = products.find(p => p.id === item.id)
    if (!product) return null
    
    const salePriceNum = product.salePrice ? Number(product.salePrice) : 0
    const regularPriceNum = product.regularPrice ? Number(product.regularPrice) : 0
    const price = salePriceNum > 0 ? salePriceNum : regularPriceNum
    
    return {
      product: {
        ...product,
        price,
        image: product.images[0]?.url
      },
      quantity: item.quantity
    }
  }).filter(Boolean) as {
    product: {
      id: number
      name: string
      price: number
      image?: string
    }
    quantity: number
  }[]

  const totalPrice = selectedItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0)
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-white">
      <PrintClientComponent />
      
      {/* PDF / Print Container */}
      {/* Using CMYK approximate colors where possible. Pure black (#000000) for text. */}
      <div className="max-w-[210mm] mx-auto bg-white text-black p-8 md:p-12 print:p-0 print:m-0 print:w-full print:max-w-none">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
          <div>
            <Image 
              src="/images/Logo HNS IT Center.png" 
              alt="HNS IT Center Logo" 
              width={200} 
              height={50} 
              className="h-12 w-auto object-contain mb-2"
              priority
            />
            <p className="text-sm text-gray-800 max-w-xs">
              Pusat IT & Gaming terpercaya di Batam. Harga terbaik, garansi resmi, teknisi berpengalaman.
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-black uppercase tracking-tight text-black mb-1">Quote Rakitan PC</h1>
            <p className="text-sm font-semibold text-gray-600">Tanggal: {currentDate}</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-3 px-2 font-black uppercase text-sm">Item</th>
                <th className="py-3 px-2 font-black uppercase text-sm w-20 text-center">Qty</th>
                <th className="py-3 px-2 font-black uppercase text-sm w-32 text-right">Harga</th>
                <th className="py-3 px-2 font-black uppercase text-sm w-32 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {selectedItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      {item.product.image ? (
                        <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200">
                          <Image src={item.product.image} alt={item.product.name} width={48} height={48} className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 border border-gray-200" />
                      )}
                      <span className="font-semibold text-sm">{item.product.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-center font-semibold">{item.quantity}</td>
                  <td className="py-4 px-2 text-right font-medium">{formatRupiah(item.product.price)}</td>
                  <td className="py-4 px-2 text-right font-bold text-black">{formatRupiah(item.product.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black">
                <td colSpan={3} className="py-4 px-2 text-right font-black uppercase">Total Harga</td>
                <td className="py-4 px-2 text-right font-black text-lg text-red-600 print:text-[#E3242B]">
                  {formatRupiah(totalPrice)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-gray-300 text-xs text-gray-500">
          <p className="font-semibold text-black mb-1">Syarat & Ketentuan:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Harga dapat berubah sewaktu-waktu tanpa pemberitahuan sebelumnya.</li>
            <li>Stok komponen tidak mengikat sebelum ada pembayaran lunas atau DP.</li>
            <li>Rakitan sudah termasuk jasa perakitan dan instalasi sistem operasi standar (jika beli SSD/HDD).</li>
          </ul>
        </div>

      </div>
    </div>
  )
}
