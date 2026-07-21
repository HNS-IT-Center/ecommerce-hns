import { ShoppingCart, MessageCircle } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { formatRupiah } from "@/lib/utils"

type ProductActionsProps = {
  onAddToCart: () => void
  isInStock: boolean
  waUrl: string
  price: number
  isSimpleProduct: boolean
}

export function ProductActions({
  onAddToCart,
  isInStock,
  waUrl,
  price,
  isSimpleProduct,
}: ProductActionsProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-border bg-background p-3 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      {!isSimpleProduct && (
        <p className="text-xs text-muted-foreground">
          Produk ini memiliki beberapa varian — hubungi kami via WhatsApp untuk pilihan yang tersedia.
        </p>
      )}
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-sm font-extrabold text-foreground md:hidden">
          {formatRupiah(price)}
        </span>
        {isSimpleProduct && (
          <Button
            variant="cta"
            size="lg"
            onClick={onAddToCart}
            disabled={!isInStock}
            className="flex-1 md:w-full"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden md:inline">Tambah ke Keranjang</span>
            <span className="md:hidden">Keranjang</span>
          </Button>
        )}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "whatsapp", size: "lg", className: "flex-1 md:w-full" })}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden md:inline">
            {isSimpleProduct ? "Beli via WhatsApp" : "Tanya Varian via WhatsApp"}
          </span>
          <span className="md:hidden">WhatsApp</span>
        </a>
      </div>
    </div>
  )
}
