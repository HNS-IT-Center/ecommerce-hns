"use client"

import { Home, LayoutGrid, Search, ShoppingCart, User } from "lucide-react"

import {
  BaubleOrnament,
  CandyCaneOrnament,
  CpuOrnament,
  GarlandSwag,
  GpuOrnament,
  PineSprig,
  StarOrnament,
} from "@/components/theme/christmas-assets"

/**
 * Tiruan Header, Footer, dan Mobile Dock untuk kotak pratinjau.
 *
 * SENGAJA tiruan, bukan komponen aslinya. `Header` yang asli adalah async
 * Server Component yang memanggil `getCategories()`, jadi tidak bisa dirender
 * di dalam komponen klien dengan cara apa pun — termasuk kalau pratinjaunya
 * memakai iframe.
 *
 * Yang WAJIB dijaga: className warna di sini harus sama dengan yang dipakai
 * komponen asli (`bg-background`, `text-foreground`, `text-muted-foreground`,
 * `border-border`, `text-brand-green`, `bg-sale-red`), karena justru kelas-kelas
 * itulah yang menerima token dari tema. Bentuk dan isinya sengaja disederhanakan
 * — ini representasi nuansa warna, bukan janji kesamaan piksel, dan akan
 * menyimpang seiring Header/Footer asli berubah.
 */
/**
 * Hiasan Natal versi pratinjau — skala lebih kecil mengikuti kotak pratinjau,
 * tapi susunan dan warnanya sama dengan yang dipakai di toko.
 */
function ChristmasPreviewDecor() {
  const ornaments = [
    { left: 10, drop: 10, Icon: CpuOrnament, tone: "text-[#c1121f]" },
    { left: 24, drop: 15, Icon: BaubleOrnament, tone: "text-[#c9992e]" },
    { left: 38, drop: 9, Icon: CandyCaneOrnament, tone: "text-[#c1121f]" },
    { left: 52, drop: 14, Icon: GpuOrnament, tone: "text-[#0b6b4f]" },
    { left: 66, drop: 10, Icon: BaubleOrnament, tone: "text-[#c1121f]" },
    { left: 80, drop: 15, Icon: CpuOrnament, tone: "text-[#c9992e]" },
    { left: 91, drop: 9, Icon: BaubleOrnament, tone: "text-[#0b6b4f]" },
  ]

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0">
      <PineSprig className="absolute -top-1 left-0 h-[26px] w-[52px] text-[#0b6b4f] opacity-90" />
      <PineSprig className="absolute -top-1 right-0 h-[26px] w-[52px] -scale-x-100 text-[#0b6b4f] opacity-90" />
      <StarOrnament className="absolute right-[44px] top-[3px] h-2.5 w-2.5 text-[#c9992e]" />
      <GarlandSwag className="absolute inset-x-0 top-[38px] h-[14px] w-full text-[#0b6b4f]" />
      {ornaments.map((o, i) => (
        <span
          key={i}
          className={`absolute block ${o.tone}`}
          style={{
            left: `${o.left}%`,
            top: `${38 + o.drop}px`,
            width: "11px",
            height: "11px",
          }}
        >
          <span
            className="absolute left-1/2 w-px -translate-x-1/2 bg-current opacity-45"
            style={{ height: `${o.drop}px`, bottom: "100%" }}
          />
          <o.Icon className="h-full w-full" />
        </span>
      ))}
    </div>
  )
}

/** Pita salju tipis di bawah navbar, meniru efek di toko. */
function SnowPreview() {
  const flakes = [
    { left: 6, size: 5, top: 8 },
    { left: 17, size: 3, top: 20 },
    { left: 28, size: 6, top: 13 },
    { left: 39, size: 4, top: 26 },
    { left: 50, size: 5, top: 9 },
    { left: 61, size: 3, top: 22 },
    { left: 72, size: 6, top: 15 },
    { left: 84, size: 4, top: 27 },
    { left: 93, size: 5, top: 11 },
  ]
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[36px] overflow-hidden">
      {flakes.map((f, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${f.left}%`,
            top: `${f.top}px`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            boxShadow: "0 0 0 1px rgba(11,61,46,0.12)",
          }}
        />
      ))}
    </div>
  )
}

export function ChromePreview({ themeId }: { themeId?: string }) {
  const isChristmas = themeId === "christmas"

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* --- Header --- */}
      <div className="relative bg-background">
        {isChristmas && <ChristmasPreviewDecor />}
        <div className="relative z-10 flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-black tracking-tight text-foreground">HNS</span>

          <nav className="hidden gap-3 sm:flex">
            <span className="text-xs font-semibold text-foreground">Kategori</span>
            <span className="text-xs font-semibold text-muted-foreground">PC Builder</span>
            <span className="text-xs font-semibold text-muted-foreground">Shop</span>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 sm:flex">
              <Search className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Cari produk…</span>
            </div>
            <div className="relative">
              <ShoppingCart className="h-4 w-4 text-foreground" />
              <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-sale-red text-[7px] font-bold text-white">
                3
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Isi halaman, sekaligus tempat salju turun --- */}
      <div className="relative bg-muted/10 px-4 py-6 text-center">
        {isChristmas && <SnowPreview />}
        <p className="relative z-10 text-[10px] text-muted-foreground">Isi halaman</p>
      </div>

      {/* --- Footer --- */}
      <div className="relative border-t border-border bg-muted/20 px-4 py-3">
        {isChristmas && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0">
            <GarlandSwag className="absolute inset-x-0 -top-[4px] h-[12px] w-full rotate-180 text-[#0b6b4f] opacity-80" />
            <StarOrnament className="absolute left-1/2 top-[3px] h-2 w-2 -translate-x-1/2 text-[#c9992e]" />
            <BaubleOrnament className="absolute left-[22%] top-[5px] h-2.5 w-2.5 text-[#c1121f]" />
            <BaubleOrnament className="absolute right-[22%] top-[5px] h-2.5 w-2.5 text-[#c9992e]" />
          </div>
        )}
        <div className="relative z-10 flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[10px] font-semibold text-foreground">HNS IT Center</span>
          <span className="text-[10px] text-muted-foreground">Perusahaan</span>
          <span className="text-[10px] text-muted-foreground">Bantuan</span>
          <span className="text-[10px] text-muted-foreground">Kontak</span>
        </div>
      </div>

      {/* --- Mobile Dock --- */}
      <div className="relative border-t border-border bg-background">
        {isChristmas && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-[4px] z-0">
            <GarlandSwag className="h-[10px] w-full rotate-180 text-[#0b6b4f] opacity-75" />
            <BaubleOrnament className="absolute left-[10%] top-[2px] h-2 w-2 text-[#c1121f]" />
            <BaubleOrnament className="absolute right-[10%] top-[2px] h-2 w-2 text-[#c9992e]" />
          </div>
        )}
        <div className="relative z-10 flex items-center justify-around px-2 py-1.5">
          {[
            { icon: Home, label: "Home", active: true },
            { icon: LayoutGrid, label: "PC Build", active: false },
            { icon: Search, label: "Shop", active: false },
            { icon: ShoppingCart, label: "Cart", active: false },
            { icon: User, label: "Akun", active: false },
          ].map(({ icon: Icon, label, active }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <Icon
                className={`h-3.5 w-3.5 ${active ? "text-brand-green" : "text-muted-foreground"}`}
              />
              <span
                className={`text-[8px] ${
                  active ? "font-bold text-brand-green" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
