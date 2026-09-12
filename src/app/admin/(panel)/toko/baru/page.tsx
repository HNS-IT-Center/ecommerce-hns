import { StoreForm } from "../store-form";

export default function AdminTokoBaruPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Tambah Toko</h1>
      <div className="mt-6">
        <StoreForm />
      </div>
    </div>
  );
}
