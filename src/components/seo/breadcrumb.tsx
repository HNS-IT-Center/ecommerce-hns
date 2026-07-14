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
    <div className="border-b border-border/50 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
          {items.map((item, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-2">/</span>}
              {item.href ? (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium line-clamp-1">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
    </div>
  )
}
