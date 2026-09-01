"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BuilderProduct, BuilderVariation } from "@/store/new-builder"
import { VariationList } from "./variation-list"

type VariationPickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Induk VARIABLE yang sedang dipilih variannya, dengan `variations` berisi.
   *
   * Boleh `null` — dan pemanggilnya WAJIB tetap merender komponen ini saat
   * null, bukan membungkusnya dalam kondisi. Lihat catatan "Selalu ter-mount"
   * di bawah.
   */
  product: BuilderProduct | null
  /**
   * Id varian yang SUDAH masuk rakitan untuk langkah ini. Dipakai menandai
   * pilihan yang sudah ada — bukan mencegahnya dipilih lagi: menekan varian
   * yang sama sekali lagi menambah kuantitasnya, sama seperti menekan Select
   * dua kali pada produk biasa.
   */
  selectedVariationIds: number[]
  onPick: (variation: BuilderVariation) => void
}

/**
 * Pemilih varian untuk PC Builder.
 *
 * Komponen inilah yang membuat produk VARIABLE boleh masuk grid wizard. Sebelum
 * ada, `fetchBuilderProducts` mengunci `type: "SIMPLE"` justru karena tidak ada
 * layar ini — produk bervarian yang lolos akan masuk rakitan tanpa varian, dan
 * harga induknya (sering nol) bukan harga barang mana pun. Keduanya karena itu
 * satu paket: kalau layar ini dibongkar, kuncinya harus kembali.
 *
 * Baris-baris variannya sendiri ada di `VariationList`, dipakai bersama dengan
 * `BuilderQuickViewDialog` supaya kedua layar itu tidak pernah menampilkan
 * harga atau status stok yang berbeda untuk varian yang sama.
 *
 * ## Selalu ter-mount, JANGAN dibungkus kondisi
 *
 * Komponen ini harus dirender terus-menerus dan dikendalikan lewat prop
 * `open` — persis seperti `SaveBuildDialog` dan `StartNewBuildDialog`. Pola
 * `{produk && <VariationPickerDialog open />}` TAMPAK lebih rapi tapi rusak:
 * dialognya lahir dengan `isOpen === true`, dan `useBackToClose` (dipasang di
 * akar `components/ui/dialog`) mendorong satu entri riwayat boneka begitu
 * lapisan terbuka. Di dev, StrictMode menjalankan efek → cleanup → efek;
 * cleanup-nya memanggil `window.history.back()`, yang `popstate`-nya baru
 * menyala SETELAH listener terpasang kembali — sehingga `onClose` ikut
 * terpanggil dan dialognya tertutup pada detik yang sama ia dibuka. Tidak ada
 * error, tidak ada apa pun di layar.
 *
 * Dialog yang lahir tertutup tidak pernah kena: efeknya `return` lebih awal
 * saat `!isOpen`, jadi tidak ada entri boneka yang perlu dibereskan.
 *
 * Alasan yang sama membuat dialog ini TIDAK BOLEH dibuka dari dalam dialog lain
 * yang sedang ditutup pada saat yang sama — lihat catatan di
 * `builder-quick-view-dialog.tsx`.
 *
 * Karena itu `product` boleh `null`, dan pemanggilnya menahan produk terakhir
 * selama animasi tutup supaya isinya tidak berkedip kosong.
 */
export function VariationPickerDialog({
  open,
  onOpenChange,
  product,
  selectedVariationIds,
  onPick,
}: VariationPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-snug">{product?.name ?? ""}</DialogTitle>
          <DialogDescription>
            Pilih opsi yang Anda inginkan. Harga mengikuti opsi yang dipilih.
          </DialogDescription>
        </DialogHeader>

        {/* Daftarnya bisa panjang (warna x kapasitas), jadi ia menggulir
            sendiri — bukan membuat dialognya memanjang melewati layar. */}
        <div className="-mr-1 max-h-[52vh] overflow-y-auto overscroll-contain pr-1">
          <VariationList
            variations={product?.variations ?? []}
            selectedVariationIds={selectedVariationIds}
            onPick={onPick}
            fallbackImage={product?.image}
          />
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Tutup
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
