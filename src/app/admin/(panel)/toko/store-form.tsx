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
    slug: string;
    name: string;
    address: string;
    mapsUrl: string;
    phone: string;
    latitude: number | null;
    longitude: number | null;
    googlePlaceId: string | null;
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
                  ID internal
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
                    Penanda baris di database, tidak muncul di URL dan tidak bisa
                    diubah setelah dibuat. Alamat halaman diatur lewat Slug di bawah.
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
                <label className={labelClass} htmlFor="slug">
                  Slug URL
                </label>
                <input
                  id="slug"
                  name="slug"
                  defaultValue={store?.slug}
                  placeholder="otomatis dari nama toko"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Alamat halaman cabang ini. Kosongkan saja — akan diturunkan
                  dari nama toko. Huruf kecil, angka, dan tanda hubung; boleh
                  diubah kapan pun tanpa memengaruhi data lain.
                </p>
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
                <label className={labelClass} htmlFor="phone">
                  Nomor WhatsApp
                </label>
                <input
                  id="phone"
                  name="phone"
                  defaultValue={store?.phone}
                  required
                  placeholder="0821-8559-8887"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Nomor cabang ini sendiri — tiap toko berbeda. Boleh ditulis
                  dengan tanda hubung; tautan WhatsApp dirapikan otomatis.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass} htmlFor="latitude">
                    Latitude
                  </label>
                  <input
                    id="latitude"
                    name="latitude"
                    inputMode="decimal"
                    defaultValue={store?.latitude ?? ""}
                    placeholder="1.1325512"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="longitude">
                    Longitude
                  </label>
                  <input
                    id="longitude"
                    name="longitude"
                    inputMode="decimal"
                    defaultValue={store?.longitude ?? ""}
                    placeholder="104.0176706"
                    className={inputClass}
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Buka Google Maps, klik kanan tepat di lokasi toko, lalu klik
                  angka koordinat yang muncul — angkanya tersalin. Tempel di
                  sini, pisahkan angka sebelum dan sesudah koma. Kosongkan kalau
                  belum tahu; peta akan memakai alamat sebagai gantinya.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="googlePlaceId">
                  Google Place ID
                </label>
                <input
                  id="googlePlaceId"
                  name="googlePlaceId"
                  defaultValue={store?.googlePlaceId ?? ""}
                  placeholder="ChIJuyX1wwyJ2TER4j__MNSJRwo"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Opsional. Dipakai tombol Petunjuk Arah supaya aplikasi Maps
                  membuka listing toko yang persis, bukan sekadar sepasang
                  koordinat.
                </p>
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
