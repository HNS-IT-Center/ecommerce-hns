import Link from "next/link"
import { Plus } from "lucide-react"
import { isDatabaseConfigured } from "@/lib/prisma/client"
import { getStores } from "@/lib/api/stores"
import { StoreList } from "./store-list"

export default async function AdminTokoPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Database belum dikonfigurasi — isi <code>DATABASE_URL</code> di <code>.env.local</code> lalu
        jalankan <code>npx prisma migrate dev</code> dan <code>npx prisma db seed</code>.
      </div>
    )
  }

  // Lewat `lib/api/stores`, bukan `getPrisma()` langsung. Di situlah saringan
  // `deletedAt` tinggal — satu tempat, sehingga halaman berikutnya yang dibuat
  // orang lain tidak bisa melewatkannya tanpa sengaja.
  const stores = await getStores()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Toko & Lokasi</h1>
        <Link
          href="/admin/toko/baru"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Toko
        </Link>
      </div>

      <div className="mt-6">
        <StoreList stores={stores} />
      </div>
    </div>
  )
}
