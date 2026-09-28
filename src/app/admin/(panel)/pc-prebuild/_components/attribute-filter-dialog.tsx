"use client"

import { useMemo, useState } from "react"
import { Check, Loader2, Search, SlidersHorizontal, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PrebuildAttributeFacet } from "@/lib/pc-prebuild/products"

/**
 * Filter atribut untuk grid produk satu langkah.
 *
 * ## Dua tingkat: pilih atributnya, lalu pilih nilainya
 *
 * Satu langkah bisa punya belasan atribut (Socket, Form Factor, Chipset, Memory
 * Type), dan tiap atribut punya nilainya sendiri. Menumpuk semuanya jadi satu
 * daftar panjang membuat staff menggulir melewati atribut yang tidak dicarinya
 * untuk sampai ke nilai yang dicarinya.
 *
 * Bentuknya karena itu dua panel: daftar atribut di kiri, nilai atribut yang
 * sedang dibuka di kanan. **Pindah panel tidak menghapus centang** — angka di
 * samping nama atribut menyatakan berapa nilai yang sudah dipilih di sana,
 * supaya penyaringan yang aktif di atribut lain tidak jadi tak kasat mata.
 * Penyaringan tersembunyi adalah cara tercepat membuat orang mengira katalognya
 * kosong.
 *
 * Di layar sempit panel kiri berubah jadi `select` biasa (CLAUDE.md §2.6).
 *
 * ## Aturannya sama dengan kompatibilitas PC Builder
 *
 * Di dalam satu atribut: **ATAU** (AM4 atau AM5). Antar atribut: **DAN**.
 * Aturan yang sama dipakai `dependSteps`/`dependAttributes`, dan dua logika
 * penyaringan berbeda di satu grid akan membuat staff menebak-nebak kenapa
 * hasilnya menyusut.
 *
 * ## Nilai berjumlah nol tetap ditampilkan
 *
 * Diredupkan, bukan disembunyikan. Staff perlu bisa membedakan "nilai ini tidak
 * ada di katalog" dari "nilai ini tidak cocok dengan prosesor yang sudah
 * dipilih" — dan daftar yang menyusut diam-diam tidak menjawab keduanya.
 *
 * ## Diterapkan saat ditekan, bukan per centang
 *
 * Satu kali muat ulang grid, bukan satu per klik. Chip filter yang aktif ikut
 * tampil di toolbar panel setelah modal ditutup, jadi filternya tetap terlihat
 * dan bisa dicabut tanpa membuka modal ini lagi.
 */

/** Nilai terpilih per atribut: `attributeId` → daftar `valueId`. */
export type AttributeFilterValue = Record<number, number[]>

/** Ambang munculnya kotak cari nilai — di bawah ini, daftarnya cukup dibaca sekaligus. */
const AMBANG_CARI = 8

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  stepName: string
  facets: PrebuildAttributeFacet[]
  loading: boolean
  value: AttributeFilterValue
  onApply: (value: AttributeFilterValue) => void
}

export function AttributeFilterDialog({
  open,
  onOpenChange,
  stepName,
  facets,
  loading,
  value,
  onApply,
}: Props) {
  /**
   * Draf — perubahan baru masuk ke grid saat "Terapkan" ditekan.
   *
   * Disalin ulang setiap kali modal DIBUKA, bukan sekali saat komponennya
   * lahir: modal ini tetap ter-mount selama panel terbuka, jadi tanpa penyalinan
   * ulang ia akan menampilkan draf basi dari sesi penyaringan sebelumnya.
   */
  const [draft, setDraft] = useState<AttributeFilterValue>(value)
  const [attributeId, setAttributeId] = useState<number | null>(null)
  const [cari, setCari] = useState("")

  /**
   * Penyalinan ulang dilakukan SAAT RENDER, bukan di dalam `useEffect`.
   *
   * Ini pola "menyesuaikan state saat prop berubah" yang dianjurkan React:
   * efek yang memanggil `setState` di badannya memicu render berantai — modal
   * tergambar sekali dengan draf lama, baru kemudian digambar ulang dengan draf
   * yang benar. Di sini bedanya terlihat: centang dari sesi sebelumnya sempat
   * berkedip sebelum tergantikan.
   */
  const [terbukaSebelumnya, setTerbukaSebelumnya] = useState(open)
  if (open !== terbukaSebelumnya) {
    setTerbukaSebelumnya(open)
    if (open) {
      setDraft(value)
      setCari("")
    }
  }

  // Atribut aktif jatuh ke yang pertama selama yang tersimpan tidak ada di
  // daftar — daftarnya bisa berubah begitu komponen di langkah sebelumnya
  // diganti, dan panel kanan yang menunjuk atribut yang sudah lenyap akan
  // tampil kosong tanpa sebab yang terlihat.
  const aktif = facets.find((f) => f.attributeId === attributeId) ?? facets[0] ?? null

  const nilaiTampil = useMemo(() => {
    if (!aktif) return []
    const kata = cari.trim().toLowerCase()
    if (!kata) return aktif.values
    return aktif.values.filter((v) => v.valueName.toLowerCase().includes(kata))
  }, [aktif, cari])

  const totalDipilih = Object.values(draft).reduce((n, ids) => n + ids.length, 0)

  function toggle(attrId: number, valueId: number) {
    setDraft((lama) => {
      const sekarang = lama[attrId] ?? []
      const baru = sekarang.includes(valueId)
        ? sekarang.filter((id) => id !== valueId)
        : [...sekarang, valueId]

      // Atribut tanpa nilai terpilih DIBUANG dari objeknya, bukan disimpan
      // sebagai array kosong: pembacanya menghitung kelompok, dan kelompok
      // kosong yang lolos ke kueri berarti syarat yang tidak bisa dipenuhi
      // produk mana pun.
      const hasil = { ...lama }
      if (baru.length === 0) delete hasil[attrId]
      else hasil[attrId] = baru
      return hasil
    })
  }

  function cabut(attrId: number, valueId: number) {
    toggle(attrId, valueId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(80vh,42rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            Filter Atribut
            <span className="min-w-0 truncate font-normal text-muted-foreground">· {stepName}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih atributnya dulu, lalu centang nilai yang ingin ditampilkan. Beberapa nilai dalam
            satu atribut berarti <span className="font-semibold">atau</span>; atribut yang berbeda
            berarti <span className="font-semibold">dan</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : facets.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Produk di kategori langkah ini belum punya atribut yang bisa disaring.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Pemilih atribut — daftar di layar lebar, select di layar sempit. */}
            <div className="shrink-0 border-b p-2 lg:w-56 lg:border-b-0 lg:border-r lg:p-0">
              <label className="block lg:hidden">
                <span className="sr-only">Atribut</span>
                <select
                  value={aktif?.attributeId ?? 0}
                  onChange={(e) => {
                    setAttributeId(Number(e.target.value))
                    setCari("")
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold"
                >
                  {facets.map((f) => {
                    const n = draft[f.attributeId]?.length ?? 0
                    return (
                      <option key={f.attributeId} value={f.attributeId}>
                        {f.attributeName}
                        {n > 0 ? ` (${n} dipilih)` : ""}
                      </option>
                    )
                  })}
                </select>
              </label>

              <div className="hidden h-full overflow-y-auto p-2 lg:block">
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Atribut
                </p>
                <ul className="space-y-0.5">
                  {facets.map((f) => {
                    const n = draft[f.attributeId]?.length ?? 0
                    const dibuka = aktif?.attributeId === f.attributeId
                    return (
                      <li key={f.attributeId}>
                        <button
                          type="button"
                          onClick={() => {
                            setAttributeId(f.attributeId)
                            setCari("")
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                            dibuka
                              ? "bg-brand-green/10 font-semibold text-brand-green"
                              : "hover:bg-muted"
                          }`}
                        >
                          <span className="min-w-0 truncate">{f.attributeName}</span>
                          {n > 0 && (
                            <span className="shrink-0 rounded-full bg-brand-green px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                              {n}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            {/* Nilai atribut yang sedang dibuka. */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {aktif && (
                <>
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Nilai — {aktif.attributeName}
                    </p>
                    {(draft[aktif.attributeId]?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((lama) => {
                            const hasil = { ...lama }
                            delete hasil[aktif.attributeId]
                            return hasil
                          })
                        }
                        className="shrink-0 text-xs font-semibold text-muted-foreground transition-colors hover:text-sale-red"
                      >
                        Kosongkan
                      </button>
                    )}
                  </div>

                  {aktif.values.length > AMBANG_CARI && (
                    <div className="flex items-center gap-2 border-b px-3 py-2">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        value={cari}
                        onChange={(e) => setCari(e.target.value)}
                        placeholder={`Cari nilai ${aktif.attributeName.toLowerCase()}…`}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      />
                    </div>
                  )}

                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {nilaiTampil.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Tidak ada nilai yang cocok dengan kata itu.
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {nilaiTampil.map((v) => {
                          const dicentang = draft[aktif.attributeId]?.includes(v.valueId) ?? false
                          return (
                            <li key={v.valueId}>
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={dicentang}
                                onClick={() => toggle(aktif.attributeId, v.valueId)}
                                className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted ${
                                  v.count === 0 ? "opacity-50" : ""
                                }`}
                              >
                                <span
                                  aria-hidden
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                    dicentang
                                      ? "border-brand-green bg-brand-green text-primary-foreground"
                                      : "border-input"
                                  }`}
                                >
                                  {dicentang && <Check className="h-3 w-3" strokeWidth={3} />}
                                </span>
                                <span className="min-w-0 flex-1 break-words text-sm">
                                  {v.valueName}
                                </span>
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                  {v.count} produk
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="shrink-0 border-t">
          {totalDipilih > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
              {facets.map((f) =>
                (draft[f.attributeId] ?? []).map((valueId) => {
                  const nilai = f.values.find((v) => v.valueId === valueId)
                  return (
                    <span
                      key={`${f.attributeId}-${valueId}`}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-green/10 py-0.5 pl-2 pr-1 text-xs font-semibold text-brand-green"
                    >
                      <span className="min-w-0 truncate">
                        {f.attributeName}: {nilai?.valueName ?? `#${valueId}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => cabut(f.attributeId, valueId)}
                        aria-label={`Cabut ${f.attributeName} ${nilai?.valueName ?? valueId}`}
                        className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-brand-green/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                })
              )}
              <button
                type="button"
                onClick={() => setDraft({})}
                className="ml-auto shrink-0 text-xs font-semibold text-muted-foreground transition-colors hover:text-sale-red"
              >
                Reset semua
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft)
                onOpenChange(false)
              }}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Terapkan{totalDipilih > 0 ? ` (${totalDipilih})` : ""}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
