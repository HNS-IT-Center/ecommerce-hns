"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import { PencilRuler, TriangleAlert } from "lucide-react"

import { formatRupiah } from "@/lib/utils"

import { PrebuildOrderButton } from "./prebuild-order-button"
import { PrebuildSaveButton } from "./prebuild-save-button"

type Produk = {
  id: number
  name: string
  slug: string
  price: number
  stock: number
  image: string | null
}

type Pilihan = {
  productId: number
  quantity: number
  label: string
  product: Produk | null
}

export type SlotTampil = {
  stepId: string
  stepName: string
  branching: boolean
  /** Indeks pilihan bawaan; -1 kalau semua produknya sudah hilang dari katalog. */
  defaultIndex: number
  options: Pilihan[]
}

/**
 * Isi halaman detail paket: spesifikasi, pemilihan varian, dan dua jalan keluar.
 *
 * ## Soal harga
 *
 * Total dijumlahkan di klien dari harga satuan yang DIKIRIM SERVER dari katalog.
 * Klien tidak pernah menurunkan harga baru — tidak ada perkalian, persentase,
 * atau potongan yang dihitung di sini; ia hanya menjumlahkan angka yang sudah
 * ditetapkan katalog. Itu perbedaan yang dijaga CLAUDE.md §2.7, dan pola yang
 * sama sudah dipakai wizard PC Builder.
 *
 * Pengamannya tetap di server: saat memesan, `prepareBuildWhatsApp` menghitung
 * ulang seluruhnya dari katalog. Jadi angka yang sampai ke CS tidak bisa
 * berasal dari halaman ini.
 */
export function PrebuildDetail({
  presetId,
  namaPaket,
  slots,
  gallery,
  performance,
}: {
  presetId: string
  namaPaket: string
  slots: SlotTampil[]
  /**
   * Galeri foto dan panel performa dioper sebagai node yang sudah jadi, bukan
   * dirender dari sini.
   *
   * Keduanya tidak butuh keadaan di klien — panel performa bahkan seluruhnya
   * statis — sedangkan komponen ini terpaksa Client Component karena pemilihan
   * varian. Merakitnya di server dan mengopernya ke sini menjaga keduanya tetap
   * di luar bundel browser, sekaligus membuat tata letak halaman ini tinggal di
   * satu tempat alih-alih terpecah antara halaman dan komponen.
   */
  gallery: ReactNode
  performance: ReactNode
}) {
  const [dipilih, setDipilih] = useState<Record<string, number>>(() =>
    Object.fromEntries(slots.map((slot) => [slot.stepId, slot.defaultIndex]))
  )

  function pilihanAktif(slot: SlotTampil): Pilihan | null {
    const i = dipilih[slot.stepId] ?? slot.defaultIndex
    return i >= 0 ? (slot.options[i] ?? null) : null
  }

  const aktif = slots.map((slot) => ({ slot, option: pilihanAktif(slot) }))
  const total = aktif.reduce(
    (jumlah, { option }) => jumlah + (option?.product ? option.product.price * option.quantity : 0),
    0
  )
  const hilang = aktif.filter(({ option }) => !option?.product).length

  const terpakai = aktif.filter(({ option }) => option?.product)

  const orderItems = terpakai.map(({ slot, option }) => ({
    productId: option!.product!.id,
    quantity: option!.quantity,
    stepName: slot.stepName || "Komponen",
  }))

  // Bentuk simpan butuh `stepId` juga — rakitan tersimpan memetakan komponen
  // kembali ke langkah wizard saat dibuka lagi.
  const saveItems = terpakai.map(({ slot, option }) => ({
    productId: option!.product!.id,
    quantity: option!.quantity,
    stepId: slot.stepId,
    stepName: slot.stepName || "Komponen",
  }))

  /**
   * Pilihan dibawa ke wizard sebagai `stepId:productId`, BUKAN sebagai indeks.
   *
   * Indeks akan berkhianat diam-diam: begitu staff mengurutkan ulang atau
   * menghapus satu pilihan di panel admin, setiap tautan yang sudah tersebar
   * lewat WhatsApp menunjuk produk lain. Pelanggan membuka tautan "RAM 32GB"
   * minggu depan dan mendapat 16GB — tanpa error, tanpa ada yang tahu.
   */
  const pick = aktif
    .filter(({ slot, option }) => slot.branching && option?.product)
    .map(({ slot, option }) => `${slot.stepId}:${option!.product!.id}`)
    .join(",")

  const builderUrl = `/build-pc?preset=${encodeURIComponent(presetId)}${
    pick ? `&pick=${encodeURIComponent(pick)}` : ""
  }`

  return (
    /**
     * Dua kolom yang berdiri sendiri-sendiri, BUKAN kisi 2×2.
     *
     * Pada kisi 2×2, tinggi baris pertama ditentukan yang tertinggi antara foto
     * dan panel performa — dan panel performa jauh lebih tinggi. Akibatnya
     * tabel spesifikasi terdorong turun dan menyisakan lubang kosong sebesar
     * ratusan piksel di bawah foto. Dua kolom terpisah membuat masing-masing
     * mengalir sesuai isinya.
     */
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <div className="space-y-8">
        {gallery}

        <section>
          <h2 className="mb-3 text-lg font-bold">Spesifikasi</h2>

        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Bagian</th>
                <th className="px-4 py-3 font-semibold">Komponen</th>
                <th className="px-4 py-3 text-right font-semibold">Jml</th>
                <th className="px-4 py-3 text-right font-semibold">Harga</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const option = pilihanAktif(slot)
                const indeksAktif = dipilih[slot.stepId] ?? slot.defaultIndex

                return (
                  <tr key={slot.stepId} className="border-b last:border-b-0">
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {slot.stepName || "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {option?.product ? (
                        <div className="flex items-start gap-3">
                          {option.product.image ? (
                            <Image
                              src={option.product.image}
                              alt=""
                              width={48}
                              height={48}
                              className="h-12 w-12 shrink-0 rounded-lg border bg-white object-contain"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="h-12 w-12 shrink-0 rounded-lg border bg-muted/40"
                            />
                          )}
                          <span className="min-w-0">
                            <Link
                              href={`/product/${option.product.slug}`}
                              className="font-medium hover:underline"
                            >
                              {option.product.name}
                            </Link>
                            {option.product.stock <= 0 && (
                              <span className="mt-0.5 block text-xs font-semibold text-sale-red">
                                Stok habis — bisa diganti di PC Builder
                              </span>
                            )}

                            {slot.branching && (
                              <span
                                className="mt-2 flex flex-wrap gap-1.5"
                                role="group"
                                aria-label={`Pilihan ${slot.stepName}`}
                              >
                                {slot.options.map((pilihan, i) => {
                                  const tersedia = pilihan.product !== null
                                  const aktifIni = i === indeksAktif
                                  return (
                                    <button
                                      key={pilihan.productId}
                                      type="button"
                                      disabled={!tersedia}
                                      aria-pressed={aktifIni}
                                      onClick={() =>
                                        setDipilih((lama) => ({ ...lama, [slot.stepId]: i }))
                                      }
                                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                        aktifIni
                                          ? "border-brand-green bg-brand-green text-primary-foreground"
                                          : "border-input bg-background hover:bg-muted"
                                      }`}
                                    >
                                      {pilihan.label}
                                    </button>
                                  )
                                })}
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sale-red">Komponen sudah tidak tersedia</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      {option?.quantity ?? 1}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      {option?.product ? formatRupiah(option.product.price * option.quantity) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hilang > 0 && (
          <p className="mt-3 flex items-start gap-2 text-sm text-sale-red">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {hilang} komponen sudah tidak tersedia dan belum ikut dihitung. Kamu tetap bisa memesan
            sisanya, atau menggantinya lewat PC Builder.
          </p>
        )}
        </section>
      </div>

      <div className="space-y-6">
        {performance}

        <aside className="lg:sticky lg:top-24">
          <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total {hilang > 0 ? "(sebagian)" : ""}
            </p>
            <p className="text-2xl font-extrabold text-sale-red">{formatRupiah(total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Harga dibaca dari katalog saat halaman ini dibuka.
            </p>
          </div>

          <PrebuildOrderButton items={orderItems} />

          {/* Menyimpan memasukkan paket ini ke mesin "Rakitan Tersimpan" yang
              sudah ada — termasuk pemberitahuan "Harga telah berubah sejak
              terakhir disimpan" di /profile/rakitan/[id]. Halaman ini sendiri
              tidak punya pembanding: harganya selalu dibaca segar, jadi tidak
              ada harga lama yang bisa berubah. */}
          <PrebuildSaveButton
            nama={namaPaket}
            items={saveItems}
            kembaliKe={`/pc-prebuild/${presetId}`}
          />

          {/* Jalan kedua: yang ingin menukar satu-dua komponen tidak perlu
              menyusun ulang dari nol — paketnya dimuat ke wizard beserta
              pilihan yang sedang aktif. */}
          <Link
            href={builderUrl}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-green px-6 py-3 text-sm font-bold text-brand-green transition-colors hover:bg-brand-green/10"
          >
            <PencilRuler className="h-4 w-4" />
            Ubah di PC Builder
          </Link>

            <p className="text-center text-xs text-muted-foreground">
              Semua komponen tetap bisa diganti sebelum pesanan dikonfirmasi.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
