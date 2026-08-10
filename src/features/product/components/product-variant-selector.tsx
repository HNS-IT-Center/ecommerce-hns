import { cn } from "@/lib/utils"

export type VariantAttribute = {
  name: string
  options: string[]
}

type ProductVariantSelectorProps = {
  attributes: VariantAttribute[]
  selected: Record<string, string>
  onSelect: (attributeName: string, option: string) => void
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
              <span className="ml-2 font-normal text-muted-foreground">{selected[attr.name]}</span>
            )}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {attr.options.map((option) => {
              const isActive = selected[attr.name] === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSelect(attr.name, option)}
                  aria-pressed={isActive}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-foreground hover:border-brand-green/50"
                  )}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
