"use client"

import Link from "next/link"
import { LogOut, Menu, Wrench } from "lucide-react"

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion"
import { buildCategoryTree } from "@/lib/utils/category-tree"
import { customerLogoutAction } from "@/app/akun/actions"
import { useCustomer } from "@/hooks/use-customer"

import type { ProductCategory } from "@/types/woocommerce"

const navLinkClassName =
  "block rounded-md px-2 py-3 text-sm font-semibold text-foreground hover:bg-muted"

const subCategoryLinkClassName =
  "block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"

interface MobileMenuProps {
  categories?: ProductCategory[]
}

export function MobileMenu({ categories = [] }: MobileMenuProps) {
  const categoryTree = buildCategoryTree(categories)
  // Status login dibaca dari /api/auth/me, bukan prop server — lihat catatan
  // di hooks/use-customer.ts kenapa membaca cookies() di Header/RootLayout
  // membuat seluruh storefront jadi dynamic.
  const { customer } = useCustomer()

  return (
    <Sheet>
      <SheetTrigger
        aria-label="Buka menu navigasi"
        className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-4/5 max-w-xs flex-col">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-4">
          <Accordion>
            {categoryTree.map((category) => (
              <AccordionItem key={category.id} value={category.id}>
                <AccordionTrigger>{category.title}</AccordionTrigger>
                <AccordionPanel>
                  {category.children.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {category.children.map((child) => (
                        <SheetClose
                          key={child.id}
                          render={<Link href={child.href} />}
                          nativeButton={false}
                          className={subCategoryLinkClassName}
                        >
                          {child.title}
                        </SheetClose>
                      ))}
                    </div>
                  ) : (
                    <p className="px-2 text-sm text-muted-foreground italic">
                      Tidak ada sub-kategori.
                    </p>
                  )}
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
            <SheetClose
              render={<Link href="/build-pc" />}
              nativeButton={false}
              className={navLinkClassName}
            >
              PC Builder
            </SheetClose>
            <SheetClose
              render={<Link href="/shop" />}
              nativeButton={false}
              className={navLinkClassName}
            >
              Shop
            </SheetClose>

            {customer ? (
              <>
                <SheetClose
                  render={<Link href="/akun" />}
                  nativeButton={false}
                  className={`${navLinkClassName} flex items-center gap-2`}
                >
                  <Wrench className="h-4 w-4 shrink-0" />
                  Rakitan Tersimpan
                </SheetClose>
                {/* Bukan SheetClose: logout adalah server action yang me-redirect
                    ke "/", jadi sheet-nya otomatis hilang mengikuti navigasi
                    halaman — tidak perlu ditutup lebih dulu secara terpisah. */}
                <form action={customerLogoutAction}>
                  <button
                    type="submit"
                    className={`${navLinkClassName} flex w-full items-center gap-2 text-left text-destructive hover:bg-destructive/10`}
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Keluar
                  </button>
                </form>
              </>
            ) : (
              <SheetClose
                render={<Link href="/login" />}
                nativeButton={false}
                className={navLinkClassName}
              >
                Masuk
              </SheetClose>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
