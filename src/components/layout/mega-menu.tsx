"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { buildCategoryTree } from "@/lib/utils/category-tree"

import type { ProductCategory } from "@/types/woocommerce"

interface MegaMenuProps {
  categories?: ProductCategory[]
}

export function MegaMenu({ categories = [] }: MegaMenuProps) {
  // Build category hierarchy (shared dengan MobileMenu, lihat lib/utils/category-tree.ts)
  const mappedCategories = buildCategoryTree(categories)

  // State to track which root category the user has hovered.
  // Stays null until the user hovers one — the first category is the
  // fallback default, derived at render instead of synced via an effect.
  const [hoveredCategoryId, setHoveredCategoryId] = React.useState<number | null>(null)
  const activeCategoryId = hoveredCategoryId ?? mappedCategories[0]?.id ?? null

  const activeCategory = mappedCategories.find(c => c.id === activeCategoryId) || mappedCategories[0]

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-transparent font-bold tracking-wide uppercase text-[13px]">
            Kategori
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="flex w-[800px] h-[500px] bg-background">
              {/* Left Sidebar - Root Categories */}
              <div className="w-1/3 flex flex-col overflow-y-auto border-r border-muted bg-muted/10 p-2 scrollbar-hide">
                {mappedCategories.map((category) => {
                  const isActive = category.id === activeCategoryId
                  return (
                    <Link
                      key={category.id}
                      href={category.href}
                      onMouseEnter={() => setHoveredCategoryId(category.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold transition-colors",
                        isActive
                          ? "bg-white text-brand-green shadow-sm border border-muted"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="uppercase tracking-wider text-[11px]">{category.title}</span>
                      <ChevronRight className={cn("h-4 w-4 transition-transform", isActive ? "text-brand-green" : "text-transparent")} />
                    </Link>
                  )
                })}
              </div>

              {/* Right Content - Subcategories */}
              <div className="w-2/3 overflow-y-auto p-8">
                {activeCategory && (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <div className="mb-6 border-b border-muted pb-4">
                      <Link href={activeCategory.href} className="text-xl font-extrabold hover:text-brand-green transition-colors uppercase">
                        {activeCategory.title}
                      </Link>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {activeCategory.description}
                      </p>
                    </div>

                    {activeCategory.children.length > 0 ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        {activeCategory.children.map((child) => (
                          <Link
                            key={child.id}
                            href={child.href}
                            className="group flex items-center text-sm font-medium text-foreground/80 transition-colors hover:text-brand-green"
                          >
                            <span className="relative">
                              {child.title}
                              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-brand-green transition-all group-hover:w-full" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed bg-muted/30">
                        <p className="text-sm text-muted-foreground">Tidak ada sub-kategori.</p>
                      </div>
                    )}
                    
                    {/* View All Button */}
                    <div className="mt-8 pt-6">
                      <Link 
                        href={activeCategory.href}
                        className="inline-flex h-9 items-center justify-center rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-brand-green/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        Lihat Semua {activeCategory.title}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        
        <NavigationMenuItem>
          <NavigationMenuLink render={<Link href="/build-pc" className={cn(navigationMenuTriggerStyle(), "bg-transparent font-bold tracking-wide uppercase text-[13px]")} />}>
            PC Builder
          </NavigationMenuLink>
        </NavigationMenuItem>
        
        <NavigationMenuItem>
          <NavigationMenuLink render={<Link href="/shop" className={cn(navigationMenuTriggerStyle(), "bg-transparent font-bold tracking-wide uppercase text-[13px]")} />}>
            Shop
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
