import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * `true` kalau lebar layar di bawah breakpoint mobile (768px).
 *
 * Memakai `useSyncExternalStore`, BUKAN `useState` + `useEffect`. Pola lama
 * memanggil `setState` langsung di dalam efek (aturan
 * `react-hooks/set-state-in-effect`) dan menghasilkan render bertingkat: render
 * pertama selalu memakai nilai awal yang salah, baru dikoreksi setelah efeknya
 * jalan. Untuk nilai yang menentukan tata letak, koreksi itu terlihat sebagai
 * kedipan.
 *
 * `useSyncExternalStore` memang dibuat untuk keadaan seperti ini — sumbernya di
 * luar React (`matchMedia`), dan React membacanya pada waktu yang tepat tanpa
 * render tambahan.
 *
 * Pola yang sama dipakai `use-is-hydrated.ts`, `carousel.tsx`, dan
 * `deals-countdown.tsx`.
 */
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

// Di server tidak ada `window`. Mengembalikan `false` (anggap desktop) supaya
// keluaran server konsisten dan hidrasi tidak berselisih; klien langsung
// mengoreksinya pada snapshot pertama kalau ternyata layarnya sempit.
function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
