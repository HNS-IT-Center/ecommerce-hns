"use client"

import { Loader2, Shuffle, Trash2, TriangleAlert } from "lucide-react"

import { ProductCardBuilder } from "@/components/shared/product-card-builder"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AttributeRequirementGroup } from "@/lib/pc-builder/compatibility"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildAlternative, PcPrebuildItem } from "@/lib/pc-prebuild/config"
import { MAX_ALTERNATIVES_PER_ITEM } from "@/lib/pc-prebuild/limits"
import type { PrebuildPickerProduct } from "@/lib/pc-prebuild/products"
import { formatRupiah } from "@/lib/utils"

import { kunciBarang, varianBawaan } from "./item-keys"
import { ProductSearchToolbar } from "./product-search-toolbar"
import { useProductSearch } from "./use-product-search"
import { VariantChips } from "./variant-chips"

/**
 * Pilihan tukar satu barang — komponen pengganti yang boleh dipilih pelanggan
 * di halaman paket.
 *
 * ## Kenapa dialog, bukan panel yang terbuka di tempat
 *
 * Versi pertama membuka daftar ini sebagai accordion di dalam kotak barang, dan
 * grid produk berubah jadi "mode memilih pengganti". Dua-duanya membuat
 * **kotak-kotak barang berpindah posisi** setiap kali daftar ini dibuka atau
 * ditutup: barisnya melebar ke bawah, kotak tetangganya ikut bergeser, dan
 * staff kehilangan tempat yang barusan ditunjuknya. Dialog membuat segala
 * sesuatu di belakangnya diam.
 *
 * ## Tidak ada Quick Preview dan filter atribut di sini
 *
 * Keduanya dialog, dan dialog di project ini tidak boleh dirantai —
 * `useBackToClose` mendorong satu entri riwayat boneka per dialog, dan yang
 * kedua memakan entri milik dirinya sendiri sehingga tertutup pada detik yang
 * sama ia dibuka. Penjelasan lengkapnya di `builder-quick-view-dialog.tsx`.
 * Kata kunci dan pengurutan tetap ada, dan untuk memilih segelintir pengganti
 * itu sudah cukup.
 *
 * ## Varian produk utama TIDAK diurus di sini
 *
 * "SSD 1TB atau 2TB" dari produk yang SAMA dinyatakan lewat chip Varian di
 * kotak barangnya. Dialog ini hanya berisi produk LAIN. Membiarkan keduanya
 * muncul di dua tempat berarti dua tempat mengubah data yang sama
 * (docs/11-pc-prebuild.md §2).
 */

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: PcBuilderStepConfig
  requiredAttributeValueGroups: AttributeRequirementGroup[]
  /** Barang yang sedang diurus. `null` saat dialognya tertutup. */
  item: PcPrebuildItem | null
  katalog: Map<number, PrebuildPickerProduct>
  onLearn: (products: PrebuildPickerProduct[]) => void
  atributBadge: number[]
  /** Sisa jatah barang bercabang di seluruh paket. */
  branchingLeft: number
  onChange: (alternatives: PcPrebuildAlternative[]) => void
}

export function AlternativesDialog({
  open,
  onOpenChange,
  step,
  requiredAttributeValueGroups,
  item,
  katalog,
  onLearn,
  atributBadge,
  branchingLeft,
  onChange,
}: Props) {
  const search = useProductSearch({
    categoryIds: step.categoryIds ?? [],
    requiredAttributeValueGroups,
    onLearn,
    limit: 18,
    // Dialognya tetap ter-mount saat tertutup; yang tidak boleh adalah
    // menembak server untuk dialog yang belum pernah dibuka.
    enabled: open,
  })

  const produkUtama = item ? katalog.get(item.productId) : null

  /**
   * Pilihan tukar yang menunjuk produk LAIN, dikelompokkan per produk.
   *
   * Satu produk = satu baris, bukan satu entri `alternatives`. Tiga varian dari
   * satu SSD adalah tiga entri di data, tapi satu baris di sini — kalau tidak,
   * ketiganya tampil sebagai tiga produk yang kelihatan berbeda padahal
   * barangnya sama.
   */
  const kelompok: { productId: number; variationIds: (number | undefined)[] }[] = []
  for (const alt of item?.alternatives ?? []) {
    if (alt.productId === item?.productId) continue
    const ada = kelompok.find((g) => g.productId === alt.productId)
    if (ada) ada.variationIds.push(alt.variationId)
    else kelompok.push({ productId: alt.productId, variationIds: [alt.variationId] })
  }

  /**
   * Jatah pilihan masih tersisa. Dua syarat, bukan satu: jumlahnya belum
   * mentok, DAN barang ini boleh bercabang sama sekali (`MAX_BRANCHING_ITEMS`
   * dihitung per paket, bukan per barang).
   */
  const bolehTambah =
    item !== null &&
    item.alternatives.length < MAX_ALTERNATIVES_PER_ITEM &&
    (item.alternatives.length > 0 || branchingLeft > 0)

  function gantiKelompok(productIdLama: number, baru: PcPrebuildAlternative[]) {
    if (!item) return
    const hasil: PcPrebuildAlternative[] = []
    let sudahDisisipkan = false
    for (const a of item.alternatives) {
      if (a.productId !== productIdLama) {
        hasil.push(a)
        continue
      }
      if (!sudahDisisipkan) {
        hasil.push(...baru)
        sudahDisisipkan = true
      }
    }
    onChange(hasil)
  }

  function toggleProduk(p: PrebuildPickerProduct) {
    if (!item) return

    // Produk yang sama dengan barang utamanya bukan pilihan tukar — kartunya
    // memang dimatikan, ini penjaga terakhirnya.
    if (p.id === item.productId) return

    const sudahAda = item.alternatives.some((a) => a.productId === p.id)
    if (sudahAda) {
      onChange(item.alternatives.filter((a) => a.productId !== p.id))
      return
    }

    if (!bolehTambah) return

    const terpakai = new Set([
      ...(item.productId > 0 ? [kunciBarang(item)] : []),
      ...item.alternatives.filter((a) => a.productId > 0).map(kunciBarang),
    ])

    onChange([
      ...item.alternatives,
      { productId: p.id, variationId: varianBawaan(p, terpakai), quantity: item.quantity },
    ])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90dvh,48rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shuffle className="h-4 w-4 shrink-0" />
            Pilihan tukar
            <span className="min-w-0 truncate font-normal text-muted-foreground">
              · {produkUtama?.name ?? step.name}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Komponen pengganti yang boleh dipilih pelanggan di halaman paket. Pilihannya ikut ke
            keranjang dan ke PC Builder. Untuk menawarkan varian lain dari produk yang{" "}
            <span className="font-semibold">sama</span>, pakai chip Varian di kotak barangnya —
            bukan di sini.
          </DialogDescription>
        </DialogHeader>

        {/* Pilihan yang sudah ada. Tingginya dibatasi supaya grid di bawah
            tidak terdorong keluar layar saat jatahnya penuh. */}
        {kelompok.length > 0 && (
          <div className="max-h-44 shrink-0 space-y-2 overflow-y-auto border-b bg-muted/30 p-3">
            {kelompok.map((g) => (
              <AlternativeRow
                key={g.productId}
                productId={g.productId}
                variationIds={g.variationIds}
                quantity={item?.quantity ?? 1}
                katalog={katalog}
                canAdd={bolehTambah}
                takenKeys={
                  new Set([
                    ...(item && item.productId > 0 ? [kunciBarang(item)] : []),
                    ...(item?.alternatives ?? [])
                      .filter((a) => a.productId > 0 && a.productId !== g.productId)
                      .map(kunciBarang),
                  ])
                }
                onReplace={(baru) => gantiKelompok(g.productId, baru)}
                onRemove={() =>
                  onChange((item?.alternatives ?? []).filter((a) => a.productId !== g.productId))
                }
              />
            ))}
          </div>
        )}

        <div className="shrink-0 border-b px-3 py-2.5">
          <ProductSearchToolbar
            compact
            search={search}
            stepId={step.id}
            stepName={step.name}
            categoryIds={step.categoryIds ?? []}
            requiredAttributeValueGroups={requiredAttributeValueGroups}
            withAttributeFilter={false}
          />
        </div>

        {!bolehTambah && (
          <p className="flex shrink-0 items-start gap-1.5 border-b bg-warning/5 px-3 py-2 text-[11px] text-warning">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
            Jatahnya penuh — maksimal {MAX_ALTERNATIVES_PER_ITEM} pilihan per barang, dan jumlah
            barang bercabang per paket juga dibatasi. Cabut salah satu untuk menambah yang lain.
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {search.memuat ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/30" />
            </div>
          ) : search.hasil.length === 0 ? (
            <p className="py-12 text-center text-xs text-muted-foreground">
              Tidak ada produk yang cocok.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {search.hasil.map((p) => {
                  const dipakai = item?.alternatives.some((a) => a.productId === p.id) ?? false
                  const barangUtama = p.id === item?.productId

                  return (
                    <div
                      key={p.id}
                      className={`relative rounded-xl ${dipakai ? "ring-2 ring-brand-green" : ""} ${
                        barangUtama ? "opacity-40" : ""
                      }`}
                      title={
                        barangUtama
                          ? "Ini barang utamanya sendiri — pakai chip Varian di kotaknya"
                          : undefined
                      }
                    >
                      {dipakai && (
                        <span className="absolute -top-2 left-2 z-[45] rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          Ditawarkan
                        </span>
                      )}

                      <ProductCardBuilder
                        product={{
                          id: p.id,
                          name: p.name,
                          price: p.cardPrice,
                          regularPrice: p.regularPrice,
                          salePrice: p.salePrice,
                          image: p.image,
                          // Barang utama dimatikan lewat stok 0: kartunya punya
                          // satu jalur penonaktifan, dan itu jalur yang sama.
                          stock: barangUtama ? 0 : p.cardStock,
                          attributes: p.attributes,
                          variations: p.variations,
                        }}
                        // Jumlah sebuah pilihan mengikuti barang utamanya, jadi
                        // kartunya tidak pernah menampilkan pengatur jumlah.
                        quantity={0}
                        allowMultiple={false}
                        displayAttributeIds={atributBadge}
                        onSelect={() => toggleProduk(p)}
                        onUpdateQuantity={() => {}}
                      />
                    </div>
                  )
                })}
              </div>

              {search.adaLagi && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={search.muatLagi}
                    disabled={search.memuatLagi}
                    className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors hover:border-brand-green hover:text-brand-green disabled:opacity-50"
                  >
                    {search.memuatLagi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Muat lebih banyak
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2.5">
          <p className="min-w-0 text-[11px] text-muted-foreground">
            {kelompok.length} dari {MAX_ALTERNATIVES_PER_ITEM} pilihan terpakai
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Selesai
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Satu PRODUK pengganti, beserta varian-varian yang ditawarkan darinya.
 *
 * Kelompok ini TIDAK punya bawaan: bawaan hanya ada pada barang utama, dan
 * seluruh isi kelompok ini memang pilihan.
 */
function AlternativeRow({
  productId,
  variationIds,
  quantity,
  katalog,
  canAdd,
  takenKeys,
  onReplace,
  onRemove,
}: {
  productId: number
  /** Varian yang ditawarkan dari produk ini. Satu entri `undefined` untuk produk SIMPLE. */
  variationIds: (number | undefined)[]
  /** Jumlah milik barangnya — dipakai saat entri baru dibuat. */
  quantity: number
  katalog: Map<number, PrebuildPickerProduct>
  canAdd: boolean
  takenKeys: Set<string>
  onReplace: (entries: PcPrebuildAlternative[]) => void
  onRemove: () => void
}) {
  const produk = katalog.get(productId) ?? null
  const aktif = variationIds.filter((id): id is number => typeof id === "number")

  function ubahVarian(vId: number) {
    if (aktif.includes(vId)) {
      // Varian terakhir tidak dimatikan lewat chip — menghapus SELURUH kelompok
      // itu tombol tersendiri, supaya "tidak menawarkan produk ini lagi" tidak
      // terjadi tanpa disengaja saat staff cuma mengurangi pilihan.
      if (aktif.length <= 1) return
      onReplace(
        aktif.filter((id) => id !== vId).map((id) => ({ productId, variationId: id, quantity }))
      )
      return
    }

    if (!canAdd) return
    onReplace([...aktif, vId].map((id) => ({ productId, variationId: id, quantity })))
  }

  return (
    <div className="space-y-1.5 rounded-lg border bg-card p-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-semibold leading-snug">
            {produk?.name ?? `Produk #${productId} tidak ada di katalog`}
          </p>
          {produk && (
            <p className="text-[10px] text-muted-foreground">
              <span className="uppercase tracking-wide">Harga satuan</span>{" "}
              <span className="font-bold tabular-nums text-foreground">
                {aktif.length > 0
                  ? aktif
                      .map((id) =>
                        formatRupiah(produk.variations.find((v) => v.id === id)?.price ?? 0)
                      )
                      .join(" · ")
                  : formatRupiah(produk.price)}
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Hapus pilihan"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-sale-red hover:text-sale-red"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {produk && produk.variations.length > 0 && (
        <VariantChips
          compact
          productId={produk.id}
          variations={produk.variations}
          selectedIds={aktif}
          canAdd={canAdd}
          takenKeys={takenKeys}
          onToggle={ubahVarian}
        />
      )}
    </div>
  )
}
