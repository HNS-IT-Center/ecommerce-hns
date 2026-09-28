"use client"

import { useActionState } from "react"
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react"

import { updateSalesDisplayNameAction } from "../actions"
import { EMPTY_SALES_NAME_STATE, MAX_SALES_DISPLAY_NAME } from "../lib/sales-name"

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"

/**
 * Nama yang tercetak sebagai "Sales:" di PDF quotation, dan yang dipakai
 * memperkenalkan diri di pesan follow-up WhatsApp.
 *
 * Dipasang di DUA tempat: `/admin/akun` (kartu "Nama Sales di Quotation") dan
 * `/profile/quotation`. Yang kedua ditambahkan 23 September 2026 karena di
 * situlah sales sebenarnya bekerja — kolom yang hanya hidup di panel admin
 * adalah kolom yang tidak pernah ditemukan orang yang membutuhkannya.
 *
 * `accountName` dipakai sebagai placeholder, bukan sebagai nilai awal: kolom
 * yang kosong harus tetap terbaca kosong, karena mengosongkannya memang berarti
 * "pakai nama akun". Kalau nama akun diisikan sebagai nilai, tidak ada lagi cara
 * membedakan "belum diatur" dari "kebetulan sama dengan nama akun".
 */
export function SalesDisplayNameForm({
  current,
  accountName,
}: {
  current: string | null
  accountName: string
}) {
  const [state, action, pending] = useActionState(
    updateSalesDisplayNameAction,
    EMPTY_SALES_NAME_STATE,
  )

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      {state.ok && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green"
        >
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {state.ok}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="salesDisplayName">
          Nama tampilan di quotation
        </label>
        <input
          id="salesDisplayName"
          name="salesDisplayName"
          type="text"
          defaultValue={current ?? ""}
          placeholder={accountName}
          maxLength={MAX_SALES_DISPLAY_NAME}
          aria-describedby="salesDisplayNameHint"
          className={inputClass}
        />
        <p id="salesDisplayNameHint" className="mt-1 text-xs text-muted-foreground">
          Kosongkan untuk memakai nama akun ({accountName}). Maksimal{" "}
          {MAX_SALES_DISPLAY_NAME} karakter.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan Nama Tampilan
      </button>
    </form>
  )
}
