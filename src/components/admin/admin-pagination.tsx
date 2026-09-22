"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * Pagination untuk daftar panel admin.
 *
 * Terpisah dari `ShopPagination` (features/shop) walau bentuknya mirip, dan itu
 * disengaja. Yang di toko memakai warna merek (`bg-brand-green`), menerima
 * `basePath` berupa string yang harus dirakit pemanggilnya, dan karena itu
 * MEMBUANG parameter lain yang sedang aktif — di panel, parameter lain itu
 * justru isi pekerjaannya: kata pencarian, kolom pengurutan, arah urutannya,
 * dan tab yang sedang terbuka. Satu tekan "Berikutnya" yang menghapus filter
 * pencarian adalah pagination yang rusak.
 *
 * Komponen klien supaya bisa membaca `useSearchParams()` sendiri: dengan begitu
 * ia menyalin SELURUH parameter yang sedang berlaku dan hanya menimpa `page`,
 * tanpa pemanggilnya perlu tahu parameter apa saja yang ada hari ini — termasuk
 * yang ditambahkan orang lain nanti.
 */

/** Berapa nomor halaman yang ditampilkan mengapit halaman aktif. */
const JENDELA = 1

function deretHalaman(halaman: number, jumlah: number): (number | "…")[] {
  if (jumlah <= 7) return Array.from({ length: jumlah }, (_, i) => i + 1)

  const out: (number | "…")[] = [1]
  if (halaman > 2 + JENDELA) out.push("…")
  for (let i = Math.max(2, halaman - JENDELA); i <= Math.min(jumlah - 1, halaman + JENDELA); i++) {
    out.push(i)
  }
  if (halaman < jumlah - 1 - JENDELA) out.push("…")
  out.push(jumlah)
  return out
}

type Props = {
  /** Halaman yang sedang dibuka, mulai dari 1. */
  page: number
  pageCount: number
  /** Jumlah SELURUH baris (bukan yang di halaman ini) — untuk keterangan rentang. */
  total: number
  /** Berapa baris per halaman, dipakai menghitung rentang "1–25". */
  pageSize: number
  /** Kata benda jamak untuk keterangan, mis. "akun". */
  labelBaris?: string
}

export function AdminPagination({ page, pageCount, total, pageSize, labelBaris = "baris" }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function hrefHalaman(tujuan: number): string {
    const sp = new URLSearchParams(searchParams.toString())
    // Halaman 1 tidak perlu ditulis di URL — alamatnya jadi lebih pendek untuk
    // ditempel ke chat, dan tetap menunjuk tempat yang sama.
    if (tujuan <= 1) sp.delete("page")
    else sp.set("page", String(tujuan))
    const qs = sp.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const dari = total === 0 ? 0 : (page - 1) * pageSize + 1
  const sampai = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Navigasi halaman"
      className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      {/*
        Keterangan rentang, bukan cuma "Halaman 2 dari 13". Saat staff sedang
        menyisir daftar untuk mencari satu orang, yang ingin diketahui adalah
        sudah sampai baris ke berapa dari berapa — nomor halaman saja tidak
        menjawab itu tanpa mengalikan di kepala.
      */}
      <p className="text-sm text-muted-foreground">
        Menampilkan <span className="font-medium text-foreground tabular-nums">{dari}</span>–
        <span className="font-medium text-foreground tabular-nums">{sampai}</span> dari{" "}
        <span className="font-medium text-foreground tabular-nums">{total}</span> {labelBaris}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <TombolArah
            href={hrefHalaman(page - 1)}
            aktif={page > 1}
            label="Halaman sebelumnya"
            arah="kiri"
          />

          {/*
            Nomor halaman disembunyikan di ponsel (`hidden sm:flex`). Di layar
            360px, tiga belas kotak nomor memaksa seluruh barisnya menggulir ke
            samping dan menabrak tombol panah — sedangkan yang benar-benar
            dipakai di ponsel cuma "berikutnya". Keterangan rentang di sebelah
            kiri tetap terbaca, jadi tidak ada informasi yang hilang.
          */}
          <div className="hidden items-center gap-1 sm:flex">
            {deretHalaman(page, pageCount).map((n, i) =>
              n === "…" ? (
                <span
                  key={`sela-${i}`}
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={hrefHalaman(n)}
                  aria-current={n === page ? "page" : undefined}
                  aria-label={`Halaman ${n}`}
                  className={`flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium tabular-nums transition-colors ${
                    n === page
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-muted"
                  }`}
                >
                  {n}
                </Link>
              ),
            )}
          </div>

          {/* Di ponsel nomor halamannya diganti penunjuk ringkas. */}
          <span className="px-2 text-sm text-muted-foreground tabular-nums sm:hidden">
            {page} / {pageCount}
          </span>

          <TombolArah
            href={hrefHalaman(page + 1)}
            aktif={page < pageCount}
            label="Halaman berikutnya"
            arah="kanan"
          />
        </div>
      )}
    </nav>
  )
}

/**
 * Tombol panah. Saat tidak bisa ditekan ia dirender sebagai `<span>`, BUKAN
 * `<Link>` yang diredupkan: tautan yang menuju halaman 0 tetap bisa ditekan
 * keyboard dan tetap masuk urutan Tab, jadi meredupkannya cuma berbohong
 * secara visual.
 */
function TombolArah({
  href,
  aktif,
  label,
  arah,
}: {
  href: string
  aktif: boolean
  label: string
  arah: "kiri" | "kanan"
}) {
  const Ikon = arah === "kiri" ? ChevronLeft : ChevronRight
  const kelas = "flex h-9 w-9 items-center justify-center rounded-md border border-border text-sm"

  if (!aktif) {
    return (
      <span aria-hidden="true" className={`${kelas} text-muted-foreground opacity-40`}>
        <Ikon className="h-4 w-4" />
      </span>
    )
  }
  return (
    <Link href={href} aria-label={label} className={`${kelas} transition-colors hover:bg-muted`}>
      <Ikon className="h-4 w-4" />
    </Link>
  )
}
