import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

type RatingProps = {
  value: number
  count?: number
  className?: string
}

export function Rating({ value, count, className }: RatingProps) {
  const rounded = Math.round(value)

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div
        className="flex"
        role="img"
        aria-label={`Rating ${value.toFixed(1)} dari 5`}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5",
              i < rounded ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/30"
            )}
          />
        ))}
      </div>
      {count != null && count > 0 && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  )
}
