"use client"

import { Check, TriangleAlert } from "lucide-react"

import { COMPONENT_ROLE_ICONS } from "../lib/component-icons"
import { chosenOption, optionId, type PrebuildSelection } from "../lib/selection"
import type { PrebuildComponent } from "../lib/types"
import { ProductImage } from "@/components/ui/product-image"

/**
 * Satu komponen di daftar isi paket.
 *
 * ## Harga per komponen SENGAJA tidak ditampilkan
 *
 * Yang dijual di halaman ini adalah paketnya, bukan tujuh barang yang kebetulan
 * dibundel. Harga satuan di tiap baris mengundang pelanggan menjumlahkan
 * sendiri lalu menawar selisihnya, dan angka yang muncul dari penjumlahan itu
 * bukan angka yang bisa dipenuhi CS.
 *
 * ## Pilihan tukar
 *
 * Yang dikirim ke pemanggil adalah `optionId()` — id varian kalau ada — bukan
 * indeks pilihan, dan bukan `productId` (dua varian satu produk berbagi induk)
 * (docs/11-pc-prebuild.md §5) — id itu jugalah yang ikut ke `?pick=` saat
 * pelanggan menekan "Rakit Sendiri". Indeks akan menunjuk produk lain begitu
 * staff mengurutkan ulang pilihannya di panel admin, tanpa error dan tanpa ada
 * yang tahu.
 *
 * Stok kosong TIDAK menyembunyikan pilihan dan tidak memindahkan bawaan — ia
 * ditandai. Pelanggan tetap boleh memilihnya; HNS yang mengabari kalau harus
 * inden.
 */

type Props = {
  component: PrebuildComponent
  selection: PrebuildSelection
  onSelect: (componentKey: string, optionId: number) => void
}

export function ComponentPicker({ component, selection, onSelect }: Props) {
  const Ikon = COMPONENT_ROLE_ICONS[component.role]
  const terpilih = chosenOption(component, selection)

  if (component.missing || !terpilih) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-sale-red/40 bg-sale-red/5 p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
          <Ikon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {component.roleLabel}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-sale-red">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            Sedang tidak tersedia
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Komponen ini tidak ikut dihitung. Hubungi kami untuk penggantinya.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card p-3.5">
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white p-1">
          <ProductImage
            src={terpilih.image}
            alt=""
            fill
            sizes="64px"
            className="object-contain p-1"
            fallbackClassName="bg-transparent"
            fallback={<Ikon className="h-6 w-6" strokeWidth={1.5} />}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Ikon className="h-3.5 w-3.5" strokeWidth={2} />
            {component.roleLabel}
          </p>
          {/* `break-words`: nama produk katalog kerap memuat kode model panjang
              tanpa spasi ("B550M-PLUS_WIFI-II"), dan kata yang tidak bisa
              dipatah akan melebar keluar kartu — lalu terpotong diam-diam oleh
              `overflow-x-clip` di html/body, bukan bisa digeser. */}
          <p className="mt-1 break-words text-sm font-semibold leading-snug">{terpilih.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{terpilih.quantity} pcs</span>
            {!terpilih.inStock && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 font-semibold text-warning">
                Stok kosong
              </span>
            )}
          </div>
        </div>
      </div>

      {component.branching && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 flex items-baseline gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bisa diganti
            {/* Jumlahnya disebut supaya terlihat ini daftar PILIHAN, bukan
                keterangan atas komponen yang sedang tampil di atasnya. */}
            <span className="font-normal normal-case tracking-normal">
              ({component.options.length} pilihan)
            </span>
          </p>

          {/*
            Di ponsel pilihannya BERTUMPUK selebar kartu; dari `sm` ke atas
            kembali menjadi deretan chip seperti sebelumnya.

            Dua alasan, dan keduanya hanya muncul di layar sempit. Pertama,
            chip lama setinggi `py-1.5` (±30px) jauh di bawah ukuran sasaran
            sentuh yang bisa ditekan dengan yakin — dan salah tekan di sini
            berarti komponen lain yang masuk keranjang. Kedua, `truncate`
            memotong justru di ujung nama, tempat yang membedakan satu pilihan
            dari yang lain ("...16GB" vs "...32GB"); yang tersisa di layar
            adalah dua baris yang terbaca sama persis.
          */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
            {component.options.map((option) => {
              const id = optionId(option)
              const aktif = id === optionId(terpilih)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(component.key, id)}
                  aria-pressed={aktif}
                  className={`flex min-h-11 w-full max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors sm:inline-flex sm:min-h-0 sm:w-auto sm:py-1.5 ${
                    aktif
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "hover:border-brand-green/50 hover:text-foreground"
                  }`}
                >
                  {/* Kotak penanda selebar ikonnya SELALU ada, juga saat tidak
                      terpilih. Tanpa itu seluruh teks pilihan bergeser 20px
                      setiap kali orang berganti pilihan — di daftar bertumpuk
                      pergeseran itu terbaca seperti halaman yang meloncat. */}
                  <span className="grid h-3.5 w-3.5 shrink-0 place-items-center">
                    {aktif && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {/* `sm:truncate` — pemotongan hanya berlaku di deretan chip.
                      Di daftar bertumpuk namanya dibiarkan turun ke baris
                      berikutnya, dan `break-words` menjaga kode model panjang
                      tanpa spasi tetap patah alih-alih melebar keluar kartu
                      (html/body memakai `overflow-x-clip`, jadi yang melebar
                      TERPOTONG diam-diam, bukan bisa digeser). */}
                  <span className="min-w-0 flex-1 break-words sm:flex-none sm:truncate">
                    {option.label}
                  </span>
                  {!option.inStock && (
                    <span className="shrink-0 text-[10px] font-normal text-warning">(kosong)</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
