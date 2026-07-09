import { ShoppingCart, MessageCircle } from "lucide-react"

type ProductActionsProps = {
  onAddToCart: () => void
  isInStock: boolean
  waUrl: string
}

export function ProductActions({ onAddToCart, isInStock, waUrl }: ProductActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onAddToCart}
        disabled={!isInStock}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-background font-bold transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ShoppingCart className="h-5 w-5" />
        Tambah ke Keranjang
      </button>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white transition-colors hover:bg-[#25D366]/90"
      >
        <MessageCircle className="h-5 w-5" />
        Beli via WhatsApp
      </a>
    </div>
  )
}
