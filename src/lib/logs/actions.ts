import { formatRupiah } from "@/lib/utils"

/**
 * Kosakata aksi `product_logs` yang dipakai lebih dari satu layar.
 *
 * Sebelumnya isi berkas ini hidup terpisah — `PRICE_ACTIONS` di halaman Logs,
 * label, warna, dan format nilai di dalam komponen tabelnya. Kartu log di
 * dashboard butuh semuanya, dan menyalinnya berarti aksi baru yang ditambahkan
 * di satu tempat diam-diam tampil berbeda di tempat lain. Berkas ini sengaja bebas `server-only` supaya
 * Client Component bisa ikut membacanya.
 */

/**
 * Aksi yang membentuk riwayat harga sebuah produk.
 *
 * `SYNC_IMPORT` ikut walau ia sendiri bukan perubahan harga: ia menandai saat
 * produknya masuk ke katalog, dan tanpa itu baris harga pertama sebuah produk
 * muncul tanpa awal cerita. Penyaring aksi di tabel tetap bisa menyempitkannya
 * ke perubahan harga saja.
 *
 * Daftar ini sengaja tetap di kode, tidak dibangun dari isi tabel seperti
 * penyaring aksi: yang menentukan sebuah aksi "soal harga" adalah artinya bagi
 * orang, bukan kebetulan namanya mengandung kata PRICE. Aksi harga baru harus
 * ditambahkan ke sini dengan sadar.
 */
export const PRICE_ACTIONS: string[] = ["UPDATE_PRICE", "SYNC_PRICE", "SYNC_IMPORT"]

/**
 * Nama aksi disimpan sebagai konstanta huruf besar supaya mudah disaring, tapi
 * yang membacanya di layar adalah staf toko — jadi labelnya diterjemahkan.
 * Aksi yang belum punya terjemahan tampil apa adanya, bukan kosong.
 */
const ACTION_LABELS: Record<string, string> = {
  UPDATE_PRICE: "Update Harga",
  SYNC_PRICE: "Sinkron Harga (WooCommerce)",
  SYNC_IMPORT: "Import dari WooCommerce",
  EDIT_PRODUCT: "Edit Produk",
  QUICK_EDIT: "Quick Edit",
  UPLOAD_PRODUCTS: "Tambah Produk",
  DELETE: "Hapus Produk",
  BULK_STATUS: "Massal: Status",
  BULK_STOCK_STATUS: "Massal: Stok",
  // Penautan ke kasir Accurate. Sengaja TIDAK masuk `PRICE_ACTIONS`: ia bukan
  // perubahan harga, dan memasukkannya akan menyelipkan baris tanpa angka ke
  // tengah riwayat harga sebuah produk. Ia menentukan ke mana harga kasir
  // mendarat — itu soal lain, dan itu sebabnya ia dicatat.
  LINK_ACCURATE: "Tautkan Kode Accurate",
  UNLINK_ACCURATE: "Lepas Tautan Accurate",
}

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

export function actionBadgeClass(action: string) {
  if (action.startsWith("BULK_")) return "bg-orange-100 text-orange-800"
  switch (action) {
    case "UPDATE_PRICE": return "bg-blue-100 text-blue-800"
    case "SYNC_PRICE": return "bg-cyan-100 text-cyan-800"
    case "SYNC_IMPORT": return "bg-teal-100 text-teal-800"
    case "EDIT_PRODUCT": return "bg-amber-100 text-amber-800"
    case "QUICK_EDIT": return "bg-purple-100 text-purple-800"
    case "UPLOAD_PRODUCTS": return "bg-green-100 text-green-800"
    case "DELETE": return "bg-red-100 text-red-800"
    case "LINK_ACCURATE": return "bg-indigo-100 text-indigo-800"
    case "UNLINK_ACCURATE": return "bg-slate-200 text-slate-900"
    default: return "bg-slate-100 text-slate-800"
  }
}

export function formatLogValue(action: string, value: string | null) {
  // String kosong pada harga berarti "tidak ada harga obral", bukan nol.
  if (value === null || value === "") return "-"
  if (action !== "UPDATE_PRICE" && action !== "SYNC_PRICE") return value

  const num = Number(value)
  if (!isNaN(num)) return formatRupiah(num)

  // Harga normal dan harga obral yang berubah bersamaan disimpan sebagai
  // objek JSON (`fieldAffected: "multiple"`), bukan satu angka. Tanpa
  // cabang ini nilainya tampil sebagai JSON mentah di kolom log.
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed as Record<string, unknown>)
        .map(([field, fieldValue]) => {
          const n = Number(fieldValue)
          const label = field === "sale_price" ? "Obral" : "Normal"
          return `${label}: ${isNaN(n) || fieldValue === "" ? "-" : formatRupiah(n)}`
        })
        .join(", ")
    }
  } catch {
    // Bukan JSON — tampilkan apa adanya.
  }
  return value
}
