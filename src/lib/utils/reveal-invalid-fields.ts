/**
 * Menunjukkan kolom form yang gagal validasi: gulir ke kolom PERTAMA yang
 * terlihat di layar, lalu nyalakan latar SEMUA kolom bermasalah selama
 * `FLASH_MS` sebelum memudar kembali.
 *
 * # Kenapa perlu
 *
 * react-hook-form hanya bisa memfokuskan kolom yang `register()`-nya punya ref
 * ke elemen asli. Kolom kustom (harga rupiah, pemilih kategori, editor varian)
 * diisi lewat `setValue`, jadi saat validasinya gagal tidak ada yang dituju —
 * pesan merah kecilnya muncul di bawah kolom yang jauh di luar layar, dan staff
 * mengira tombol simpannya tidak bekerja.
 *
 * # Cara pakai
 *
 * Beri pembungkus tiap kolom `data-field="<kunci>"` (kunci bebas, cukup cocok
 * dengan yang dikirim pemanggil), lalu panggil fungsi ini dari `onInvalid`
 * milik `handleSubmit`. Kolom yang sedang tersembunyi (mis. harga induk pada
 * produk bervariasi) dilewati.
 *
 * Gaya nyalanya ada di `globals.css` (`[data-field-flash]`) — memakai
 * `box-shadow` + latar, bukan padding/border, supaya tidak menggeser tata letak.
 */

export const FLASH_MS = 3000

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'

const timers = new WeakMap<HTMLElement, number>()

function flash(el: HTMLElement) {
  const previous = timers.get(el)
  if (previous !== undefined) window.clearTimeout(previous)
  // Mulai ulang dari awal kalau tombol simpan ditekan lagi selagi menyala:
  // atribut dicabut, reflow dipaksa, lalu dipasang lagi.
  el.removeAttribute("data-field-flash")
  void el.offsetWidth
  el.setAttribute("data-field-flash", "")
  timers.set(
    el,
    window.setTimeout(() => {
      el.removeAttribute("data-field-flash")
      timers.delete(el)
    }, FLASH_MS),
  )
}

/**
 * @returns jumlah kolom yang ditemukan & dinyalakan. Nol berarti kunci yang
 *   gagal tidak punya pembungkus `data-field` yang terlihat — pemanggil
 *   sebaiknya tetap memberi tahu staff lewat cara lain (toast).
 */
export function revealInvalidFields(root: ParentNode | null, keys: Iterable<string>): number {
  if (!root || typeof window === "undefined") return 0

  const wanted = new Set(keys)
  const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-field]"))
    .filter((el) => wanted.has(el.dataset.field ?? "") && el.getClientRects().length > 0)
    // Urutan TAMPIL, bukan urutan DOM: di desktop kolom kanan (kategori) bisa
    // berada lebih atas daripada kolom harga di kolom kiri.
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
    .map(({ el }) => el)

  const first = targets[0]
  if (!first) return 0

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  first.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" })

  // Kursor ikut pindah hanya ke isian teks biasa. Combobox/pemilih tidak
  // difokuskan — fokus membuka daftar pilihannya dan menutupi kolom yang
  // justru sedang ditunjukkan.
  const input = first.querySelector<HTMLElement>(FOCUSABLE)
  if (input && !input.matches('[role="combobox"], [aria-haspopup]')) {
    input.focus({ preventScroll: true })
  }

  targets.forEach(flash)
  return targets.length
}
