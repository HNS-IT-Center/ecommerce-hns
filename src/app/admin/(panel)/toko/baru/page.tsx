import { requirePageView } from "@/lib/auth"
import { AdminBackLink } from "@/components/admin/admin-back-link"
import { StoreForm } from "../store-form";

export default async function AdminTokoBaruPage() {
  await requirePageView("toko")

  return (
    <div className="mx-auto max-w-3xl">
      <AdminBackLink href="/admin/toko">Kembali ke daftar toko</AdminBackLink>
      <h1 className="text-2xl font-bold">Tambah Toko</h1>
      <div className="mt-6">
        <StoreForm />
      </div>
    </div>
  );
}
