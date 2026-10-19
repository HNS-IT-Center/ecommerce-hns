import type { useToastManager } from "@/components/ui/toast"
import type { HasilTautDariSku } from "@/lib/api/accurate/price-table"

type ToastManager = ReturnType<typeof useToastManager>

/** Cukup lama untuk membaca nama barang Accurate-nya — itulah gunanya toast ini. */
const LAMA_TAMPIL_MS = 12_000

function ringkas(baris: string[], batas: number): string {
  if (baris.length <= batas) return baris.join(" · ")
  return `${baris.slice(0, batas).join(" · ")} · dan ${baris.length - batas} lainnya`
}

/**
 * Umumkan hasil `tautkanDariSku` sesudah produk disimpan — dipakai formulir
 * produk, Quick Edit, dan isian SKU di tabel, supaya ketiganya berbicara
 * dengan kalimat yang sama.
 *
 * Nama barang ACCURATE yang ditampilkan, bukan nama produk web: staff sudah
 * tahu produk apa yang baru ia simpan. Yang belum ia lihat adalah barang kasir
 * yang kini menentukan stoknya — dan di situlah SKU yang salah ketik ketahuan
 * (mis. varian ROSIE yang ternyata mendapat kode BLUE).
 *
 * @param kecualiWooId produk yang kodenya ditautkan sendiri oleh staff lewat
 *   kolom Kode Accurate sesudah ini — pengumuman otomatisnya akan menyesatkan
 *   kalau kolom itu berisi kode lain.
 */
export function umumkanTautanOtomatis(
  toastManager: ToastManager,
  hasil: HasilTautDariSku | undefined,
  kecualiWooId?: number,
) {
  if (!hasil) return

  const ditautkan = hasil.ditautkan.filter((b) => b.wooId !== kecualiWooId)
  if (ditautkan.length > 0) {
    toastManager.add({
      title:
        ditautkan.length === 1
          ? "Tertaut ke Accurate dari SKU"
          : `${ditautkan.length} produk tertaut ke Accurate dari SKU`,
      description: `${ringkas(
        ditautkan.map((b) => `${b.kode} → ${b.namaBarang}`),
        3,
      )}. Stoknya ikut Accurate mulai sinkron berikutnya — kalau barangnya keliru, betulkan SKU dan Kode Accurate-nya.`,
      timeout: LAMA_TAMPIL_MS,
      data: { variant: "success" },
    })
  }

  const dilewati = hasil.dilewati.filter((b) => b.wooId !== kecualiWooId)
  if (dilewati.length > 0) {
    toastManager.add({
      title: "SKU berisi kode Accurate, tapi tidak ditautkan otomatis",
      description: ringkas(
        dilewati.map((b) => `${b.kode}: ${b.alasan}`),
        2,
      ),
      timeout: LAMA_TAMPIL_MS,
    })
  }

  if (hasil.galat) {
    toastManager.add({
      title: "Pemeriksaan tautan Accurate gagal",
      description: `Produk tetap tersimpan. Tautkan lewat kolom Kode Accurate kalau SKU-nya kode Accurate. (${hasil.galat})`,
      timeout: LAMA_TAMPIL_MS,
      data: { variant: "danger" },
    })
  }
}
