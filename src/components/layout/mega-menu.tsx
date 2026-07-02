"use client"

import * as React from "react"
import Link from "next/link"

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

const categories = [
  {
    title: "Laptop & PC",
    href: "/category/laptop-pc",
    description: "Laptop gaming, office, dan Desktop PC rakitan.",
    children: [
      { title: "Laptop Gaming", href: "/category/laptop-gaming" },
      { title: "Laptop Office", href: "/category/laptop-office" },
      { title: "Desktop PC", href: "/category/desktop-pc" },
    ],
  },
  {
    title: "PC Components",
    href: "/category/pc-components",
    description: "VGA, Motherboard, Prosesor, dan komponen rakit PC lainnya.",
    children: [
      { title: "Prosesor (CPU)", href: "/category/cpu" },
      { title: "Motherboard", href: "/category/motherboard" },
      { title: "VGA / Graphics Card", href: "/category/vga" },
      { title: "RAM / Memory", href: "/category/ram" },
    ],
  },
  {
    title: "Gaming Gear",
    href: "/category/gaming-gear",
    description: "Mouse, Keyboard, Headset, dan perlengkapan gaming.",
    children: [
      { title: "Keyboard Mechanical", href: "/category/keyboard" },
      { title: "Mouse Gaming", href: "/category/mouse" },
      { title: "Headset", href: "/category/headset" },
    ],
  },
]

export function MegaMenu() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-transparent">Kategori</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
              {categories.map((category) => (
                <li key={category.title} className="row-span-3">
                  <NavigationMenuLink render={
                    <Link
                      className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                      href={category.href}
                    />
                  }>
                    <div className="mb-2 mt-4 text-lg font-medium">
                      {category.title}
                    </div>
                    <p className="text-sm leading-tight text-muted-foreground mb-4">
                      {category.description}
                    </p>
                    <div className="flex flex-col gap-2 mt-auto">
                      {category.children.map((child) => (
                        <span key={child.title} className="text-sm text-primary hover:underline">
                          {child.title}
                        </span>
                      ))}
                    </div>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink render={<Link href="/build-pc" className={cn(navigationMenuTriggerStyle(), "bg-transparent")} />}>
            PC Builder
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink render={<Link href="/shop" className={cn(navigationMenuTriggerStyle(), "bg-transparent")} />}>
            Promo
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
