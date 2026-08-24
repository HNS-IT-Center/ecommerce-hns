"use client"

import { useRef, useState } from "react"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { fetchBuilderProducts } from "@/features/builder/actions"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildOption } from "@/lib/pc-prebuild/config"
import { MAX_BRANCHING_SLOTS, MAX_OPTIONS_PER_SLOT } from "@/lib/pc-prebuild/limits"
import { formatRupiah } from "@/lib/utils"

/**
 * Satu langkah = satu slot, berisi satu sampai tiga pilihan.
 *
 * Pilihan PERTAMA adalah bawaan; itulah yang dipakai kalau pelanggan tidak
 * memilih apa-apa. Pilihan kedua dan seterusnya muncul sebagai tombol di
 * halaman paket — "16 GB / 32 GB", "Hitam / Putih".
 *
 * Dipindah ke berkas sendiri saat panelnya dirombak. Logikanya tidak berubah;
 * yang berubah cuma elemen mentah menjadi komponen `Input`/`Button` bersama,
 * supaya panel ini ikut berubah kalau gaya tombol project berubah.
 */

type SlotEditorProps = {
  step: PcBuilderStepConfig
  options: PcPrebuildOption[]
  saranAwal: ComboboxOption[]
  namaProduk: Record<number, string>
  hargaProduk: Record<number, number>
  onHargaProduk: (peta: Record<number, number>) => void
  bolehTambahCabang: boolean
  onNamaProduk: (productId: number, label: string) => void
  onChange: (options: PcPrebuildOption[]) => void
}

export function SlotEditor({
  step,
  options,
  saranAwal,
  namaProduk,
  hargaProduk,
  onHargaProduk,
  bolehTambahCabang,
  onNamaProduk,
  onChange,
}: SlotEditorProps) {
  const terpakai = options.map((o) => o.productId)
  const bercabang = options.length > 1
  const terisi = options.length > 0 && options[0].productId > 0
  const bisaTambah =
    options.length > 0 && options.length < MAX_OPTIONS_PER_SLOT && (bercabang || bolehTambahCabang)

  function ubahIndeks(i: number, patch: Partial<PcPrebuildOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
  }

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        terisi ? "border-input bg-card" : "border-dashed bg-muted/20"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {step.name}
        </span>
        {bercabang && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            pelanggan memilih
          </span>
        )}
      </div>

      <div className="space-y-2">
        {(options.length === 0 ? [null] : options).map((option, i) => (
          <OptionRow
            key={option ? `${option.productId}-${i}` : "kosong"}
            step={step}
            saranAwal={saranAwal}
            option={option}
            isBawaan={i === 0}
            /** Produk yang sudah dipakai pilihan lain di slot ini — tidak boleh kembar. */
            terlarang={terpakai.filter((_, idx) => idx !== i)}
            namaProduk={namaProduk}
            hargaProduk={hargaProduk}
            onHargaProduk={onHargaProduk}
            onPilih={(productId, label) => {
              if (productId === null) {
                onChange(options.filter((_, idx) => idx !== i))
                return
              }
              if (option) ubahIndeks(i, { productId })
              else onChange([...options, { productId, quantity: 1 }])
              if (label) onNamaProduk(productId, label)
            }}
            onLabel={(label) => ubahIndeks(i, { label: label || undefined })}
            onQty={(quantity) => ubahIndeks(i, { quantity })}
          />
        ))}
      </div>

      {bisaTambah && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...options, { productId: 0, quantity: 1 }])}
          className="mt-2 text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah pilihan
        </Button>
      )}

      {options.length >= MAX_OPTIONS_PER_SLOT && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Maksimal {MAX_OPTIONS_PER_SLOT} pilihan per komponen.
        </p>
      )}
      {!bercabang && options.length > 0 && !bolehTambahCabang && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Sudah ada {MAX_BRANCHING_SLOTS} komponen yang bisa dipilih di paket ini — batasnya
          tercapai.
        </p>
      )}
    </div>
  )
}

type OptionRowProps = {
  step: PcBuilderStepConfig
  saranAwal: ComboboxOption[]
  option: PcPrebuildOption | null
  isBawaan: boolean
  terlarang: number[]
  namaProduk: Record<number, string>
  hargaProduk: Record<number, number>
  onHargaProduk: (peta: Record<number, number>) => void
  onPilih: (productId: number | null, label?: string) => void
  onLabel: (label: string) => void
  onQty: (quantity: number) => void
}

/**
 * Satu baris pilihan: produk + label tombol + jumlah.
 *
 * Daftar produknya dimuat di server (20 teratas per langkah) supaya dropdown
 * tidak kosong saat dibuka; begitu staff mengetik tiga huruf, daftarnya
 * diperbarui lewat `fetchBuilderProducts` — server action yang SAMA dengan yang
 * dipakai wizard pelanggan.
 */
function OptionRow({
  step,
  saranAwal,
  option,
  isBawaan,
  terlarang,
  namaProduk,
  hargaProduk,
  onHargaProduk,
  onPilih,
  onLabel,
  onQty,
}: OptionRowProps) {
  const labelProduk = option && option.productId ? (namaProduk[option.productId] ?? "") : ""
  const [teks, setTeks] = useState(labelProduk)
  const [daftar, setDaftar] = useState<ComboboxOption[]>(saranAwal)
  const [nilaiTerakhir, setNilaiTerakhir] = useState(labelProduk)
  const queryTerakhir = useRef("")

  // Diselaraskan saat render, bukan lewat useEffect — aturan lint repo ini
  // menolak setState di dalam efek (`react-hooks/set-state-in-effect`).
  if (labelProduk !== nilaiTerakhir) {
    setNilaiTerakhir(labelProduk)
    setTeks(labelProduk)
  }

  async function cari(q: string) {
    queryTerakhir.current = q
    const { products } = await fetchBuilderProducts({
      categoryIds: step.categoryIds ?? [],
      requiredAttributeValueIds: [],
      searchQuery: q,
      limit: 20,
    })
    // Balasan yang datang terlambat diabaikan, supaya hasil ketikan lama tidak
    // menimpa hasil ketikan terbaru.
    if (queryTerakhir.current !== q) return
    setDaftar(products.map((p) => ({ id: p.id, label: p.name })))

    // Harga ikut dicatat dari hasil pencarian. Tanpa ini, produk yang baru
    // dipilih staff tidak punya angka sampai halaman dimuat ulang — dan total
    // paketnya terlihat lebih murah dari yang sebenarnya.
    onHargaProduk(Object.fromEntries(products.map((p) => [p.id, p.price])))
  }

  // Produk yang sudah dipakai pilihan lain disembunyikan dari daftar. `productId`
  // adalah identitas pilihan — termasuk di URL nanti — jadi dua pilihan dengan
  // produk yang sama tidak bisa dibedakan satu sama lain.
  const daftarBersih = daftar.filter((o) => !terlarang.includes(Number(o.id)))

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_4.5rem_6.5rem_auto] sm:items-center">
      <Combobox
        requireOption
        value={teks}
        onValueChange={(v) => {
          setTeks(v)
          if (v.trim().length >= 3) void cari(v.trim())
        }}
        onCommit={(label) => {
          const cocok = daftarBersih.find(
            (o) => o.label.toLowerCase() === label.trim().toLowerCase()
          )
          onPilih(cocok ? Number(cocok.id) : null, cocok?.label)
        }}
        options={daftarBersih}
        placeholder={isBawaan ? "Komponen bawaan…" : "Pilihan lain…"}
        inputClassName="h-9 text-sm"
      />

      <Input
        value={option?.label ?? ""}
        onChange={(e) => onLabel(e.target.value)}
        placeholder={isBawaan ? "Label (ops.)" : "Label"}
        aria-label={`Label pilihan untuk ${step.name}`}
        disabled={!option?.productId}
        title="Teks tombol pilihan — mis. 16 GB, Hitam, Samsung. Kosong = pakai nama produk."
        className="h-9 text-sm"
      />

      <Input
        type="number"
        min={1}
        value={option?.quantity ?? 1}
        onChange={(e) => onQty(Number(e.target.value))}
        disabled={!option?.productId}
        aria-label={`Jumlah ${step.name}`}
        className="h-9 text-sm tabular-nums"
      />

      {/* Keterangan untuk staff, dibaca dari katalog. TIDAK ikut tersimpan ke
          preset — lihat lib/pc-prebuild/config.ts. */}
      <span className="text-right text-sm font-semibold tabular-nums text-sale-red sm:text-xs">
        {option?.productId && hargaProduk[option.productId] !== undefined
          ? formatRupiah(hargaProduk[option.productId] * option.quantity)
          : "—"}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setTeks("")
          onPilih(null)
        }}
        disabled={!option?.productId}
        aria-label={`Hapus pilihan ${step.name}`}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
