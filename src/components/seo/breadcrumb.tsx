import Link from "next/link"

export type BreadcrumbItem = {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="bg-background pt-4 pb-2">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <nav className="text-sm flex items-center flex-wrap" aria-label="Breadcrumb">
          {items.map((item, i) => (
            <span key={i} className="flex items-center">
              {i > 0 && <span className="mx-2 text-muted-foreground text-xs">{'>'}</span>}
              {item.href ? (
                <Link href={item.href} className="text-muted-foreground hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">
                  {item.label.length > 40 ? item.label.slice(0, 40) + "..." : item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      </div>
    </div>
  )
}
