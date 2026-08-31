"use client"

import Image from "next/image"
import { Check } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatRupiah } from "@/lib/utils"
import type { BuilderProduct, BuilderVariation } from "@/store/new-builder"

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
 * Yang ditampilkan per baris adalah HARGA VARIANNYA SENDIRI, dibaca dari
 * katalog — bukan harga induk, dan bukan hasil hitungan apa pun (CLAUDE.md
 * §2.7). Varian yang habis tetap terdaftar tapi tidak bisa ditekan: pelanggan
 * berhak tahu barangnya ada, cuma sedang kosong.
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
  const variations = product?.variations ?? []
  const terpilih = new Set(selectedVariationIds)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-snug">{product?.name ?? ""}</DialogTitle>
          <DialogDescription>
            Pilih opsi yang Anda inginkan. Harga mengikuti opsi yang dipilih.
          </DialogDescription>
        </DialogHeader>

        {/* Daftarnya bisa panjang (warna × kapasitas), jadi ia menggulir
            sendiri — bukan membuat dialognya memanjang melewati layar. */}
        <div className="-mr-1 max-h-[52vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {variations.map((variation) => {
            const habis = variation.stock <= 0
            const sudahDipilih = terpilih.has(variation.id)
            const adaDiskon =
              variation.salePrice > 0 && variation.regularPrice > variation.salePrice

            return (
              <button
                key={variation.id}
                type="button"
                disabled={habis}
                onClick={() => onPick(variation)}
                aria-pressed={sudahDipilih}
                className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                  habis
                    ? "cursor-not-allowed border-border/50 opacity-55"
                    : sudahDipilih
                      ? "cursor-pointer border-brand-green bg-brand-green/5 hover:bg-brand-green/10"
                      : "cursor-pointer border-border/60 hover:border-blue-500 hover:bg-accent"
                }`}
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
                  <Image
                    src={variation.image || product?.image || "/placeholder.jpg"}
                    alt={variation.label}
                    fill
                    // Wadahnya tetap 48px di semua ukuran layar.
                    sizes="48px"
                    className="object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{variation.label}</span>
                    {sudahDipilih && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-green" strokeWidth={3} />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span
                      className={`text-sm font-bold ${adaDiskon ? "text-sale-red" : "text-foreground"}`}
                    >
                      {formatRupiah(variation.price)}
                    </span>
                    {adaDiskon && (
                      <span className="text-[10px] text-muted-foreground line-through">
                        {formatRupiah(variation.regularPrice)}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    habis
                      ? "bg-muted text-muted-foreground"
                      : "bg-brand-green/10 text-brand-green"
                  }`}
                >
                  {habis ? "HABIS" : "TERSEDIA"}
                </span>
              </button>
            )
          })}

          {variations.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada opsi yang tersedia untuk produk ini.
            </p>
          )}
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
