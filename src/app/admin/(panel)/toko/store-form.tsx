import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard"
import { createStore, updateStore } from "./actions"

type StoreFormProps = {
  store?: {
    id: string
    name: string
    address: string
    hours: string
    mapsUrl: string
    phone: string
    sortOrder: number
  }
}

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
const labelClass = "mb-1 block text-sm font-semibold text-foreground"

export function StoreForm({ store }: StoreFormProps) {
  const isEdit = Boolean(store)
  const action = isEdit ? updateStore : createStore

  return (
    <UnsavedChangesGuard>
      <form action={action} className="max-w-xl space-y-4">
        <div>
          <label className={labelClass} htmlFor="id">
            ID (slug unik, tidak bisa diubah setelah dibuat)
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
        </div>

        <div>
          <label className={labelClass} htmlFor="name">
            Nama Toko
          </label>
          <input id="name" name="name" defaultValue={store?.name} required className={inputClass} />
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
          <label className={labelClass} htmlFor="hours">
            Jam Operasional
          </label>
          <input
            id="hours"
            name="hours"
            defaultValue={store?.hours}
            required
            placeholder="mis. Setiap Hari : 09:00 - 21:00 WIB"
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
            placeholder="mis. 0811-7000-0000"
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
            Urutan Tampil (angka lebih kecil tampil dulu)
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={store?.sortOrder ?? 0}
            required
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isEdit ? "Simpan Perubahan" : "Tambah Toko"}
        </button>
      </form>
    </UnsavedChangesGuard>
  )
}
