import type { ReactNode } from "react"

/**
 * Badge sudut kiri atas kartu produk dengan efek pita terlipat.
 *
 * Dulu ini tiga blok markup terpisah di `ProductCard` (diskon, HOT, dan NEW
 * versi lama). Ketiganya nyaris identik, dan itu terbukti mahal: saat Deal dan
 * Hot dipindah ke gaya terlipat, "New" tertinggal sebagai kotak datar di dalam
 * container gambar dengan titik jangkar yang berbeda — cacat visual yang baru
 * ketahuan belakangan. Satu komponen membuat perubahan gaya berikutnya berlaku
 * untuk semua badge sekaligus.
 *
 * Warna dioper sebagai kelas Tailwind utuh, BUKAN dirangkai (`bg-${color}`),
 * karena pemindai Tailwind hanya mengenali kelas yang tertulis lengkap. Nilainya
 * mengalir lewat token `--card-badge-*` supaya Theme Editor bisa menimpanya
 * per-scope (lihat `.theme-card` di globals.css).
 */
interface FoldedBadgeProps {
  /** Kelas latar badge, mis. `bg-(--card-badge-hot)`. */
  colorClass: string
  /** Kelas latar segitiga lipatan — versi lebih gelap dari `colorClass`. */
  foldColorClass: string
  /** Ikon opsional di kiri label. */
  icon?: ReactNode
  children: ReactNode
}

export function FoldedBadge({ colorClass, foldColorClass, icon, children }: FoldedBadgeProps) {
  return (
    <div className="absolute -left-1.5 top-3 z-[40] drop-shadow-sm pointer-events-none">
      <div
        className={`flex items-center gap-0.5 rounded-r-md rounded-tl-md px-1.5 py-0.5 text-xs font-bold text-white tracking-wide ${colorClass}`}
      >
        {icon}
        {children}
      </div>
      {/* Segitiga siku-siku yang membuat pita seolah terlipat ke belakang kartu.
          Ukurannya sengaja sama dengan offset `-left-1.5` di atas, jadi ujung
          lipatannya jatuh tepat di tepi kartu. */}
      <div
        className={`h-1.5 w-1.5 ${foldColorClass}`}
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
      />
    </div>
  )
}
