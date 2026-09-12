import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"

export type BreadcrumbItem = {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

/**
 * Jejak navigasi.
 *
 * Beberapa keputusan kecil yang membedakannya dari versi sebelumnya:
 *
 * - Pemisahnya `ChevronRight`, bukan karakter `>` mentah. Karakter itu dilukis
 *   memakai metrik font teks — tebalnya tidak sama dengan ikon lain di situs,
 *   posisi vertikalnya ikut baseline huruf sehingga terlihat melayang, dan
 *   ukurannya berubah mengikuti font pengguna.
 *
 * - Ruas terakhir memakai `aria-current="page"`. Sebelumnya ia hanya <span>
 *   tebal, jadi pembaca layar tidak punya cara tahu ruas mana halaman yang
 *   sedang dibuka.
 *
 * - Pemotongan nama panjang diserahkan ke CSS (`truncate` + `max-w-*`), bukan
 *   `slice(0, 40)`. Memotong per karakter memenggal kata di tengah dan tetap
 *   meleset di layar sempit, karena 40 karakter tidak berarti lebar yang sama
 *   untuk setiap nama produk.
 *
 * - Ikon rumah menggantikan kata "Beranda" — pola yang sudah lazim dan
 *   menyisakan ruang untuk ruas yang benar-benar informatif. Labelnya tetap
 *   dibawa `sr-only` supaya tetap terbaca pembaca layar.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="bg-background pt-5 pb-3">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-y-1 text-sm">
            {items.map((item, i) => {
              const isLast = i === items.length - 1
              const isFirst = i === 0

              return (
                <li key={i} className="flex min-w-0 items-center">
                  {i > 0 && (
                    <ChevronRight
                      className="mx-1 h-4 w-4 shrink-0 text-muted-foreground/50"
                      aria-hidden="true"
                    />
                  )}

                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {isFirst && <Home className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      <span className={isFirst ? "sr-only sm:not-sr-only" : undefined}>
                        {item.label}
                      </span>
                    </Link>
                  ) : (
                    /* Ruas terakhir sengaja TIDAK ditebalkan. Ia yang paling
                       panjang (nama produk penuh), dan teks tebal sepanjang itu
                       bersaing dengan <h1> di bawahnya yang mengatakan hal yang
                       sama. Warna penuh saja sudah cukup memisahkannya dari
                       ruas lain yang meredup. */
                    <span
                      aria-current={isLast ? "page" : undefined}
                      className="max-w-[16rem] truncate px-1.5 py-1 text-foreground md:max-w-md"
                      title={item.label}
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      </div>
    </div>
  )
}
