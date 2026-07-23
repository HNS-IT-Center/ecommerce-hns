import Link from "next/link"
import { Plus, Pencil } from "lucide-react"
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma/client"
import { deleteStore } from "./actions"

export default async function AdminTokoPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Database belum dikonfigurasi — isi <code>DATABASE_URL</code> di <code>.env.local</code> lalu
        jalankan <code>npx prisma migrate dev</code> dan <code>npx prisma db seed</code>.
      </div>
    )
  }

  const prisma = getPrisma()
  const stores = await prisma.store.findMany({ orderBy: { sortOrder: "asc" } })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Toko & Lokasi</h1>
        <Link
          href="/admin/toko/baru"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Toko
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {stores.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada data toko.</p>
        )}
        {stores.map((store) => (
          <div
            key={store.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4"
          >
            <div>
              <h2 className="font-bold">{store.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{store.address}</p>
              <p className="mt-1 text-sm text-muted-foreground">{store.hours}</p>
              <p className="mt-1 text-sm text-muted-foreground">WA: {store.phone}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/admin/toko/${store.id}`}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Edit ${store.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <form action={deleteStore}>
                <input type="hidden" name="id" value={store.id} />
                <button
                  type="submit"
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
                >
                  Hapus
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
