import { cn } from "@/lib/utils"

export type VariantAttribute = {
  name: string
  options: string[]
}

type ProductVariantSelectorProps = {
  attributes: VariantAttribute[]
  selected: Record<string, string>
  onSelect: (attributeName: string, option: string) => void
}

export function ProductVariantSelector({ attributes, selected, onSelect }: ProductVariantSelectorProps) {
  if (attributes.length === 0) return null

  return (
    <div className="space-y-4">
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
