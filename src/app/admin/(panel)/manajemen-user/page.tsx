import type { Metadata } from "next"
import { requirePageView } from "@/lib/auth"
import { bisaAkses, ADMIN_PAGES } from "@/lib/auth/permissions"
import { listRoles } from "@/lib/api/roles"
import { ManajemenUserView } from "./view"

export const metadata: Metadata = {
  title: "Manajemen User — Admin HNS IT Center",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ManajemenUserPage() {
  // Penjaga halaman (redirect kalau tak boleh lihat). Penjaga sebenarnya tetap
  // di server action; ini mencegah membuka halaman yang tak akan bisa dipakai.
  const { izin } = await requirePageView("manajemen-user")
  const bolehEdit = bisaAkses(izin, "manajemen-user", "edit")
  const roles = await listRoles()

  // Daftar halaman untuk matriks izin — nama tampil, urut sesuai definisi.
  const pages = Object.entries(ADMIN_PAGES).map(([key, label]) => ({ key, label }))

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Manajemen User</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buat peran dan atur apa yang boleh diakses tiap peran — per halaman, dengan tingkat{" "}
          <strong>lihat</strong>, <strong>edit</strong>, atau <strong>tak ada</strong>.
        </p>
      </div>

      <div className="mt-6">
        <ManajemenUserView roles={roles} pages={pages} bolehEdit={bolehEdit} />
      </div>
    </div>
  )
}
