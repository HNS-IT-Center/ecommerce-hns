import { useEffect, useState } from "react"
import type { CurrentCustomer } from "@/lib/auth/customer"

export type CustomerStatus =
  | { loading: true; customer: null }
  | { loading: false; customer: CurrentCustomer | null }

/**
 * Status login pelanggan, dibaca dari `/api/auth/me` — BUKAN dari prop server
 * yang menembus `cookies()` di Header/RootLayout. Alasannya ditulis di
 * `app/api/auth/me/route.ts`: membaca cookie langsung di Server Component
 * yang membungkus seluruh halaman menandai SETIAP halaman sebagai dynamic,
 * termasuk yang sebelumnya statis (/cart, /faq, dst).
 *
 * `loading: true` sampai fetch pertama selesai — pemanggil menampilkan
 * keadaan "guest" untuk sesaat, sama seperti `CartBadge` menampilkan 0 barang
 * sebelum hydrated. Tidak menyebabkan flicker yang berarti karena endpoint
 * ini kecil dan cepat.
 */
export function useCustomer(): CustomerStatus {
  const [status, setStatus] = useState<CustomerStatus>({ loading: true, customer: null })

  useEffect(() => {
    let cancelled = false

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { customer: null }))
      .then((data: { customer: CurrentCustomer | null }) => {
        if (!cancelled) setStatus({ loading: false, customer: data.customer })
      })
      .catch(() => {
        if (!cancelled) setStatus({ loading: false, customer: null })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return status
}
