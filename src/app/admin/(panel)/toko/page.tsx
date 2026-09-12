import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { isDatabaseConfigured } from "@/lib/prisma/client";
import { getActiveStores } from "@/lib/api/stores";
import { requirePageView } from "@/lib/auth";
import { StoreList } from "./store-list";

export default async function AdminTokoPage() {
  await requirePageView("toko");
  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Database belum dikonfigurasi — isi <code>DATABASE_URL</code> di{" "}
        <code>.env.local</code> lalu jalankan{" "}
        <code>npx prisma migrate deploy</code> dan <code>npx prisma db seed</code>.
      </div>
    );
  }

  // Lewat `lib/api/stores`, bukan `getPrisma()` langsung. Di situlah saringan
  // `deletedAt` tinggal — satu tempat, sehingga halaman berikutnya yang dibuat
  // orang lain tidak bisa melewatkannya tanpa sengaja.
  const stores = await getActiveStores();

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

      {/*
        Tanpa peringatan ini, panel yang kosong terlihat seperti keadaan awal yang
        wajar — padahal artinya halaman lokasi dan halaman kontak sedang tidak
        menampilkan satu cabang pun ke pelanggan. Keadaan itu pernah terjadi tanpa
        ada yang menyadarinya sampai halamannya dibuka sendiri.
      */}
      {stores.length === 0 && (
        <p className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Tidak ada toko aktif. Halaman <strong>Lokasi Toko</strong> dan{" "}
            <strong>Kontak</strong> sedang tidak menampilkan cabang apa pun ke
            pelanggan. Tambahkan minimal satu toko.
          </span>
        </p>
      )}

      <div className="mt-6">
        <StoreList stores={stores} />
      </div>
    </div>
  );
}
