import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

type AdminBackLinkProps = {
  /** Halaman induk yang dituju — ditulis eksplisit, bukan riwayat browser. */
  href: string
  /** Mis. "Kembali ke daftar toko". Sebut tujuannya, bukan sekadar "Kembali". */
  children: React.ReactNode
  className?: string
}

/**
 * Tautan "← Kembali ke …" di puncak halaman sunting/tambah panel admin.
 *
 * Tujuannya SELALU halaman induk yang ditulis pemanggil, BUKAN
 * `router.back()`. Halaman sunting sering dibuka langsung — dari tautan yang
 * dibagikan sesama staff, dari tab baru, atau sesudah login — dan di situ
 * riwayat browser kosong atau menunjuk ke luar panel, sehingga tombol "back"
 * melempar staff ke tempat yang tidak ia duga. Tautan biasa juga ikut
 * dicegat `UnsavedChangesGuard` seperti tautan lain, jadi perubahan yang
 * belum disimpan tetap ditanyakan.
 *
 * Server Component (tanpa state), jadi bisa dipasang langsung di `page.tsx`.
 */
export function AdminBackLink({ href, children, className }: AdminBackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {children}
    </Link>
  )
}
