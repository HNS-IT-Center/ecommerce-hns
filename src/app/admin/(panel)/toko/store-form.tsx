"use client";

import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";

import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard";
import type { StoreHours } from "@/lib/utils/opening-hours";
import { createStore, updateStore } from "./actions";
import { StoreHoursEditor } from "./store-hours-editor";
import { EMPTY_STORE_STATE } from "./state";

type StoreFormProps = {
  store?: {
    id: string;
    name: string;
    address: string;
    mapsUrl: string;
    hours: StoreHours[];
    sortOrder: number;
  };
};

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background";
const labelClass = "mb-1 block text-sm font-semibold text-foreground";

export function StoreForm({ store }: StoreFormProps) {
  const isEdit = Boolean(store);
  const [state, action, pending] = useActionState(
    isEdit ? updateStore : createStore,
    EMPTY_STORE_STATE,
  );

  return (
    <UnsavedChangesGuard>
      <form action={action} className="max-w-4xl space-y-5">
        {state.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </p>
        )}

        {/* Dua kolom sejak md: tujuh baris jam membuat formulir satu kolom
            memanjang jauh ke bawah, sampai identitas toko dan jamnya tidak
            pernah terlihat bersamaan. Tingginya kini seimbang di kedua sisi. */}
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <fieldset className="min-w-0">
            <legend className={labelClass}>Identitas Toko</legend>
            <p className="mb-2 text-xs text-muted-foreground">
              Nama tampil sebagai judul kartu di halaman lokasi.
            </p>

            <div className="space-y-3 rounded-xl border border-input p-3">
              <div>
                <label className={labelClass} htmlFor="id">
                  ID (slug unik)
                </label>
                <input
                  id="id"
                  name="id"
                  defaultValue={store?.id}
                  readOnly={isEdit}
                  required
                  placeholder="mis. nagoya-gateway"
                  className={`${inputClass} ${isEdit ? "cursor-not-allowed opacity-60" : ""}`}
                />
                {!isEdit && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tidak bisa diubah setelah dibuat.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="name">
                  Nama Toko
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={store?.name}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="address">
                  Alamat Lengkap
                </label>
                <textarea
                  id="address"
                  name="address"
                  defaultValue={store?.address}
                  required
                  rows={3}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="mapsUrl">
                  Link Google Maps
                </label>
                <input
                  id="mapsUrl"
                  name="mapsUrl"
                  type="url"
                  defaultValue={store?.mapsUrl}
                  required
                  placeholder="https://maps.app.goo.gl/..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="sortOrder">
                  Urutan Tampil
                </label>
                <input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={store?.sortOrder ?? 0}
                  required
                  className={`${inputClass} w-28`}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Angka lebih kecil tampil lebih dulu.
                </p>
              </div>
            </div>
          </fieldset>

          {/* Nomor WhatsApp per toko dihapus: seluruh percakapan masuk lewat satu
              pintu, dan nomornya hidup di NEXT_PUBLIC_WHATSAPP_CS_NUMBER. */}

          <fieldset className="min-w-0">
            <legend className={labelClass}>Jam Operasional</legend>
            <p className="mb-2 text-xs text-muted-foreground">
              Centang <em>Tutup</em> untuk hari libur.
            </p>

            <StoreHoursEditor initial={store?.hours ?? []} />
          </fieldset>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Tambah Toko"}
        </button>
      </form>
    </UnsavedChangesGuard>
  );
}
