import { cn } from "@/lib/utils";
import { optionKey } from "@/features/product/lib/get-unavailable-options";

export type VariantAttribute = {
  name: string;
  options: string[];
};

type ProductVariantSelectorProps = {
  attributes: VariantAttribute[]
  selected: Record<string, string>
  onSelect: (attributeName: string, option: string) => void
  /**
   * Kombinasi yang tidak ada di katalog, dari `getUnavailableOptions`. Dihitung
   * di induk supaya strip mobile dan pemilih desktop memakai hasil yang sama.
   */
  unavailableOptions?: Set<string>
  /**
   * Menyala sesaat setelah pembeli menekan "Keranjang" di bar mengambang
   * sementara variannya belum lengkap — halaman menggulir ke sini dan cincin
   * ini yang memberi tahu apa yang kurang.
   */
  isHighlighted?: boolean
}

/** Sasaran gulungan dari tombol keranjang di bar aksi mengambang (mobile). */
export const VARIANT_SELECTOR_ID = "product-variant-selector"

export function ProductVariantSelector({
  attributes,
  selected,
  onSelect,
  unavailableOptions,
  isHighlighted = false,
}: ProductVariantSelectorProps) {
  if (attributes.length === 0) return null

  return (
    <div
      id={VARIANT_SELECTOR_ID}
      className={cn(
        "space-y-4 scroll-mt-24 rounded-xl transition-all duration-300",
        isHighlighted && "bg-brand-green/5 p-3 ring-2 ring-brand-green ring-offset-2 ring-offset-background",
      )}
    >
      {attributes.map((attr) => (
        <div key={attr.name}>
          <span className="text-sm font-semibold text-foreground">
            {attr.name}
            {selected[attr.name] && (
              <span className="ml-2 font-normal text-muted-foreground">
                {selected[attr.name]}
              </span>
            )}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {attr.options.map((option) => {
              const isActive = selected[attr.name] === option;
              const isUnavailable =
                unavailableOptions?.has(optionKey(attr.name, option)) ?? false;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSelect(attr.name, option)}
                  disabled={isUnavailable}
                  aria-pressed={isActive}
                  /* Kombinasi yang tidak ada dicoret dan diredupkan, bukan
                     disembunyikan: pembeli tetap bisa melihat bahwa ukuran itu
                     memang ada di lini produknya, hanya tidak dalam warna yang
                     sedang dipilih — dan itu petunjuk untuk mencoba warna lain,
                     bukan kebuntuan tanpa keterangan. */
                  title={isUnavailable ? "Kombinasi ini tidak tersedia" : undefined}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                    isUnavailable
                      ? "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground/50 line-through"
                      : isActive
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-border text-foreground hover:border-brand-green/50",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
