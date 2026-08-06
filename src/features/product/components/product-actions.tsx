import { ShoppingCart, MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";

type ProductActionsProps = {
  onAddToCart: (e: React.MouseEvent) => void;
  canAddToCart: boolean;
  showCartButton: boolean;
  addToCartHint?: string;
  waUrl: string;
  waLabel: string;
  price: number;
};

export function ProductActions({
  onAddToCart,
  canAddToCart,
  showCartButton,
  addToCartHint,
  waUrl,
  waLabel,
  price,
}: ProductActionsProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-border bg-background p-3 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      {addToCartHint && (
        <p className="text-xs text-muted-foreground">{addToCartHint}</p>
      )}
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-sm font-extrabold text-foreground md:hidden">
          {formatRupiah(price)}
        </span>
        {showCartButton && (
          <Button
            variant="default"
            size="lg"
            onClick={onAddToCart}
            disabled={!canAddToCart}
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
          className={buttonVariants({
            variant: "default",
            size: "lg",
            className:
              "flex-1 md:w-full bg-[#25D366] hover:bg-[#128C7E] text-white",
          })}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden md:inline">{waLabel}</span>
          <span className="md:hidden">WhatsApp</span>
        </a>
      </div>
    </div>
  );
}
