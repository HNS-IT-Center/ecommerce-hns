"use client"

import { useMemo } from "react"
import { TriangleAlert } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProductImage } from "@/components/ui/product-image"

import { COMPONENT_ROLE_ICONS } from "../lib/component-icons"
import { chosenOption, optionId, type PrebuildSelection } from "../lib/selection"
import type { PrebuildComponent } from "../lib/types"

/**
 * Satu komponen di daftar isi paket.
 *
 * Sejak 24 September 2026 daftarnya tinggal di KOLOM KANAN halaman detail,
 * bersebelahan dengan galeri — bukan lagi grid dua kolom selebar halaman.
 * Kolom itu setengah lebar layar, jadi bentuknya baris ringkas: foto 40px,
 * label peran, lalu nama produk atau dropdown pilihan. Panel performa yang
 * dulu menempati kolom itu turun ke bawah (lihat `prebuild-detail.tsx`).
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
 * Dropdown hanya muncul untuk komponen yang PUNYA pilihan tukar. Komponen
 * berpilihan tunggal tampil sebagai teks: dropdown yang isinya satu baris
 * mengundang orang menekannya lalu tidak mendapat apa-apa, dan membuat yang
 * benar-benar bisa ditukar tenggelam di antaranya.
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

  /**
   * Base UI `Select` tidak mengetahui label sebuah pilihan sebelum daftarnya
   * dibuka. Tanpa `items`, tombolnya menampilkan nilai mentah — angka id
   * produk, bukan nama komponennya (pola yang sama dipakai `ShopSort`).
   */
  const items = useMemo(
    () =>
      component.options.map((option) => ({
        value: String(optionId(option)),
        label: option.label,
      })),
    [component.options]
  )

  if (component.missing || !terpilih) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-sale-red/40 bg-sale-red/5 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
          <Ikon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-white">
        <ProductImage
          src={terpilih.image}
          alt=""
          fill
          sizes="40px"
          className="object-contain p-1"
          fallbackClassName="bg-transparent"
          fallback={<Ikon className="h-4 w-4" strokeWidth={1.5} />}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Ikon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>{component.roleLabel}</span>
          <span aria-hidden>·</span>
          <span className="text-foreground">{terpilih.quantity} pcs</span>
          {/* Jumlah pilihan disebut supaya terlihat baris ini BISA diganti,
              bukan sekadar keterangan atas komponen yang kebetulan berpanah. */}
          {component.branching && (
            <span className="rounded-full bg-brand-green/10 px-1.5 py-0.5 font-semibold normal-case tracking-normal text-brand-green">
              {component.options.length} pilihan
            </span>
          )}
        </div>

        {component.branching ? (
          <div className="mt-1.5">
            <Select
              items={items}
              value={String(optionId(terpilih))}
              onValueChange={(val: string | null) => {
                if (!val) return
                onSelect(component.key, Number(val))
              }}
            >
              {/*
                `min-h-11` menimpa tinggi bawaan 32px milik trigger. Sasaran
                sentuh di bawah 44px sulit ditekan dengan yakin, dan salah
                tekan di sini berarti komponen lain yang masuk keranjang.

                `whitespace-normal` + `line-clamp-2`: nama katalog kerap
                panjang ("Klevv Bolt V DDR5 16GB 5600MHz"), dan pemotongan satu
                baris memotong justru di ujung nama — tempat yang membedakan
                satu pilihan dari yang lain ("...16GB" vs "...32GB").
              */}
              <SelectTrigger
                aria-label={`Pilih ${component.roleLabel}`}
                // `line-clamp-2!` bertanda penting: `SelectTrigger` sendiri
                // memasang `line-clamp-1` lewat varian yang persis sama, dan
                // tanpa penanda itu yang menang tinggal urusan urutan keluaran
                // Tailwind — nama panjang akan terpotong satu baris lagi tanpa
                // ada yang mengubah berkas ini.
                className="h-auto min-h-11 w-full whitespace-normal bg-background py-2 text-left *:data-[slot=select-value]:line-clamp-2!"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="bottom" align="start" alignItemWithTrigger={false}>
                {component.options.map((option) => {
                  const id = optionId(option)
                  return (
                    // `*:whitespace-normal` melonggarkan `whitespace-nowrap`
                    // bawaan ItemText — popup selebar trigger, jadi nama panjang
                    // yang tidak boleh patah akan terpotong diam-diam.
                    <SelectItem
                      key={id}
                      value={String(id)}
                      className="min-h-11 items-start py-2 *:whitespace-normal sm:min-h-0"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="break-words">{option.label}</span>
                        {!option.inStock && (
                          <span className="text-[11px] font-normal text-warning">Stok kosong</span>
                        )}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {/* Penanda stok pilihan yang SEDANG aktif. Di daftar chip lama ia
                menempel pada tiap pilihan sekaligus; begitu daftarnya masuk
                dropdown, yang terpilih tidak terlihat lagi sampai dibuka. */}
            {!terpilih.inStock && (
              <p className="mt-1.5 flex items-start gap-1 text-xs font-semibold text-warning">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Stok kosong — tetap bisa dipesan, kami kabari soal indennya
              </p>
            )}
          </div>
        ) : (
          <div className="mt-0.5">
            {/* `break-words`: nama produk katalog kerap memuat kode model
                panjang tanpa spasi ("B550M-PLUS_WIFI-II"), dan kata yang tidak
                bisa dipatah akan melebar keluar kartu — lalu terpotong
                diam-diam oleh `overflow-x-clip` di html/body, bukan bisa
                digeser. */}
            <p className="break-words text-sm font-semibold leading-snug">{terpilih.label}</p>
            {!terpilih.inStock && (
              <span className="mt-1 inline-block rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                Stok kosong
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
