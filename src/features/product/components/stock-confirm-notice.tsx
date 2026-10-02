import { TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

type StockConfirmNoticeProps = {
  /** Tautan WhatsApp CS, biasanya sama dengan tombol WhatsApp di sebelahnya. */
  waUrl: string
  className?: string
}

/**
 * Peringatan di atas tombol "Tambah ke Keranjang": stok di katalog tidak
 * selalu sama dengan stok fisik di toko, jadi pembeli diminta konfirmasi ke
 * CS sebelum membeli. Dipakai halaman produk (desktop) dan Quick View —
 * versi ringkas untuk bar mobile ada langsung di product-actions.tsx.
 *
 * Tanpa varian `dark:`. Storefront tidak pernah memasang class `.dark`, tapi
 * di Tailwind v4 `dark:` bawaan mengikuti `prefers-color-scheme` — di HP yang
 * dark mode, teksnya berubah kuning terang di atas latar yang tetap putih.
 */
export function StockConfirmNotice({ waUrl, className }: StockConfirmNoticeProps) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Stok dapat berubah sewaktu-waktu. Wajib konfirmasi ketersediaan ke Customer Service
        sebelum membeli.{" "}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          Tanya CS via WhatsApp
        </a>
      </p>
    </div>
  )
}
