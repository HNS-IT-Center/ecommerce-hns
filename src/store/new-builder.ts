import { create } from "zustand"
import { persist } from "zustand/middleware"
import { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import { isAttributeCompatible } from "@/lib/pc-builder/compatibility"

/**
 * Satu pilihan varian pada produk bervarian.
 *
 * `id`-nya adalah id baris VARIATION di tabel `products` — baris varian juga
 * sebuah Product, jadi dialah yang memegang harga, stok, dan SKU. Begitu
 * dipilih, id inilah yang menjadi `BuilderProduct.id`, sehingga seluruh jalur
 * hilir (penetapan harga katalog, quotation cetak, rakitan tersimpan) tidak
 * perlu tahu apa pun soal varian: bagi mereka ia produk biasa dengan id biasa.
 */
export type BuilderVariation = {
  id: number
  /** Nilai atribut pembedanya, mis. "1TB · Hitam". */
  label: string
  price: number
  regularPrice: number
  salePrice: number
  stock: number
  image?: string
}

export type BuilderProduct = {
  id: number
  name: string
  price: number
  regularPrice?: number
  salePrice?: number
  image?: string
  slug: string
  sold: number
  stock: number
  type: string
  /**
   * Atribut yang dipakai memeriksa kompatibilitas antar step (Socket, Form
   * Factor, dst).
   *
   * Untuk pilihan hasil varian, isinya atribut INDUK — bukan atribut baris
   * variannya sendiri. Atribut sebuah varian adalah atribut PEMBEDA-nya
   * (Kapasitas, Warna), dan socket sebuah motherboard tidak pernah tercatat di
   * sana. Kalau atribut varian yang dipakai, langkah yang bergantung pada
   * socket akan membuang pilihan yang sebenarnya cocok — diam-diam, tanpa
   * pesan apa pun.
   */
  attributes: { attributeId: number, attributeName: string, valueId: number, valueName: string }[]
  /** Terisi hanya pada pilihan hasil varian: id baris induk yang bertipe VARIABLE. */
  parentId?: number
  /** Nama induk. Sama isinya dengan `name`, disimpan terpisah supaya `displayVariationName` bisa dipakai apa adanya. */
  parentName?: string
  /** Nilai atribut pembeda varian yang dipilih, mis. "1TB · Hitam". */
  variationLabel?: string
  /**
   * Varian yang tersedia. Pada kartu katalog: anak-anak dari induk VARIABLE
   * ini. Pada pilihan yang sudah masuk rakitan: saudara-saudaranya — sengaja
   * ikut disimpan supaya tombol "Ganti varian" tetap bekerja setelah halaman
   * dimuat ulang dari localStorage, tanpa bergantung pada produknya kebetulan
   * ada di halaman grid yang sedang terbuka.
   */
  variations?: BuilderVariation[]
}

export type BuilderSelection = {
  product: BuilderProduct
  quantity: number
}

/**
 * Menjumlahkan seluruh komponen rakitan menurut harga satuan yang diberikan
 * PEMANGGIL — satu-satunya penjumlahan rakitan yang ada di project ini.
 *
 * `unitPriceOf` dioper dari luar dengan alasan yang sama seperti `groupTotal`
 * di lib/cart/grouping.ts: di panel `/build-pc` harga satuannya berasal dari
 * katalog (`useBuilderCatalogPricing`), bukan dari angka yang mengendap di
 * localStorage. Menjumlahkan harga satuan katalog boleh — yang dilarang
 * CLAUDE.md §2.7 adalah menurunkan harga baru dari rumus.
 *
 * `skip` dipakai membuang komponen yang sudah tidak terbit di katalog, supaya
 * total di layar sama dengan total yang berangkat ke CS.
 *
 * Sengaja fungsi lepas, bukan method store: ia dipanggil saat render dengan
 * harga katalog yang TIDAK tersimpan di store, dan menaruhnya di dalam store
 * hanya akan mengundang orang menjumlahkan harga localStorage lagi.
 */
export function sumBuilderSelections(
  selections: Record<string, BuilderSelection[]>,
  unitPriceOf: (selection: BuilderSelection) => number,
  skip?: (selection: BuilderSelection) => boolean
): number {
  return Object.values(selections).reduce((total, stepSelections) => {
    if (!Array.isArray(stepSelections)) return total
    return (
      total +
      stepSelections.reduce((sum, sel) => {
        if (skip?.(sel)) return sum
        return sum + unitPriceOf(sel) * sel.quantity
      }, 0)
    )
  }, 0)
}

/**
 * Apakah pilihan pada step `dependent` cocok dengan pilihan pada step yang ia
 * andalkan (`parent`), menurut `dependAttributes` milik step `dependent`.
 *
 * Aturannya SAMA PERSIS dengan query grid di `fetchBuilderProducts` karena
 * keduanya memanggil `lib/pc-builder/compatibility.ts` — IRISAN: cukup ada
 * SATU nilai yang sama per atribut.
 *
 * Bukan himpunan bagian. Menuntut kandidat memiliki SELURUH nilai induk tetap
 * salah untuk kasus yang paling sering muncul: casing ATX tercatat sebagai
 * tiga baris "Motherboard Size" (Mini-ITX, Micro-ATX, ATX) karena ketiganya
 * memang muat, sedangkan motherboard Micro-ATX hanya punya satu. Dengan aturan
 * himpunan bagian, motherboard yang justru cocok dinyatakan tidak cocok dan
 * dibuang diam-diam. Irisan juga simetris — "casing dulu" dan "motherboard
 * dulu" memberi jawaban yang sama.
 *
 * Induk yang tidak punya nilai untuk suatu atribut tidak memberi syarat apa
 * pun — sama seperti grid, yang tidak mengirim kelompok apa pun untuknya.
 *
 * Dibiarkan sebagai pembungkus tipis: store bekerja dengan `BuilderProduct`,
 * dan pemanggilnya tidak perlu tahu bentuk minimum yang diminta lapisan aturan.
 */
export function isSelectionCompatible(
  dependent: BuilderProduct,
  parent: BuilderProduct,
  dependAttributes: number[] | undefined
): boolean {
  return isAttributeCompatible(dependent, parent, dependAttributes)
}

interface NewBuilderState {
  steps: PcBuilderStepConfig[]
  selections: Record<string, BuilderSelection[]> // stepId -> array of selected products
  activeStepId: string | null
  budget: string // stored as string for input field
  
  setSteps: (steps: PcBuilderStepConfig[]) => void
  selectProduct: (stepId: string, product: BuilderProduct) => void
  removeProduct: (stepId: string, productId?: number) => void
  updateQuantity: (stepId: string, productId: number, quantity: number) => void
  setActiveStep: (stepId: string) => void
  setBudget: (budget: string) => void
  clearSelections: () => void
  /**
   * Timpa seluruh `selections` sekaligus, dipakai tombol "Lanjutkan di
   * Builder" dari rakitan tersimpan (lib/api/saved-pc-builds.ts) — beda dari
   * `selectProduct` yang menambah satu per satu dan menjalankan pemeriksaan
   * kompatibilitas antar step. Rakitan tersimpan sudah pernah lolos
   * pemeriksaan itu saat pertama disusun, jadi tidak diulang di sini.
   */
  hydrateSelections: (selections: Record<string, BuilderSelection[]>) => void
  reset: () => void
}

export const useNewBuilderStore = create<NewBuilderState>()(
  persist(
    (set) => ({
  steps: [],
  selections: {},
  activeStepId: null,
  budget: "",

  setSteps: (steps) => {
    set({ steps, activeStepId: steps.length > 0 ? steps[0].id : null })
  },

  selectProduct: (stepId, product) => {
    set((state) => {
      const currentStep = state.steps.find(s => s.id === stepId)
      if (!currentStep) return state

      const existingSelections = state.selections[stepId] || []
      let newStepSelections: BuilderSelection[]
      
      if (currentStep.allowMultiple) {
        const exists = existingSelections.find(s => s.product.id === product.id)
        if (exists) {
          newStepSelections = existingSelections.map(s => 
            s.product.id === product.id ? { ...s, quantity: s.quantity + 1 } : s
          )
        } else {
          newStepSelections = [...existingSelections, { product, quantity: 1 }]
        }
      } else {
        newStepSelections = [{ product, quantity: 1 }]
      }

      const newSelections = { ...state.selections, [stepId]: newStepSelections }
      
      state.steps.forEach(otherStep => {
        if (otherStep.id === stepId) return;
        const otherStepSelections = newSelections[otherStep.id]
        if (!otherStepSelections || otherStepSelections.length === 0) return;

        const otherDependsOnCurrent = otherStep.dependSteps?.includes(stepId)
        const currentDependsOnOther = currentStep.dependSteps?.includes(otherStep.id)
        
        if (!otherDependsOnCurrent && !currentDependsOnOther) return;

        /**
         * Aturannya SAMA PERSIS dengan query grid di `fetchBuilderProducts`
         * karena keduanya memanggil `lib/pc-builder/compatibility.ts` — cukup
         * ada SATU nilai yang sama per atribut (irisan). Kalau grid dan
         * pemangkasan ini berbeda aturan, pelanggan melihat kartu yang lolos
         * grid lalu dibuang begitu diklik.
         *
         * Dulu pemeriksaan ini memakai `.find()` + `!==`, yang hanya melihat
         * nilai PERTAMA milik tiap atribut. Satu atribut bisa punya banyak
         * nilai — casing ATX tercatat sebagai tiga baris "Motherboard Size"
         * (Mini-ITX, Micro-ATX, ATX) — sehingga nilai mana yang terambil
         * bergantung urutan baris di database, dan casing yang justru
         * dirancang memuat motherboard Micro-ATX bisa dinyatakan tidak cocok.
         * Akibatnya motherboard yang sudah dipilih terbuang diam-diam tanpa
         * satu pun pesan. Jangan kembalikan ke perbandingan satu nilai.
         */
        const validOtherSelections = otherStepSelections.filter(otherSel => {
          if (
            otherDependsOnCurrent &&
            !isAttributeCompatible(otherSel.product, product, otherStep.dependAttributes)
          ) {
            return false;
          }

          if (
            currentDependsOnOther &&
            !isAttributeCompatible(product, otherSel.product, currentStep.dependAttributes)
          ) {
            return false;
          }

          return true;
        });

        if (validOtherSelections.length === 0) {
          delete newSelections[otherStep.id];
        } else {
          newSelections[otherStep.id] = validOtherSelections;
        }
      })
      
      return { selections: newSelections }
    })
  },

  updateQuantity: (stepId, productId, quantity) => {
    set((state) => {
      const existing = state.selections[stepId]
      if (!existing) return state
      
      if (quantity <= 0) {
        const filtered = existing.filter(s => s.product.id !== productId)
        const newSelections = { ...state.selections }
        if (filtered.length === 0) {
          delete newSelections[stepId]
        } else {
          newSelections[stepId] = filtered
        }
        return { selections: newSelections }
      }
      
      const updated = existing.map(s => s.product.id === productId ? { ...s, quantity } : s)
      return { selections: { ...state.selections, [stepId]: updated } }
    })
  },

  removeProduct: (stepId, productId) => {
    set((state) => {
      const newSelections = { ...state.selections }
      if (productId && newSelections[stepId]) {
        const filtered = newSelections[stepId].filter(s => s.product.id !== productId)
        if (filtered.length === 0) {
          delete newSelections[stepId]
        } else {
          newSelections[stepId] = filtered
        }
      } else {
        delete newSelections[stepId]
      }
      return { selections: newSelections }
    })
  },

  setActiveStep: (stepId) => set({ activeStepId: stepId }),
  
  setBudget: (budget) => set({ budget }),

  clearSelections: () => set({ selections: {} }),

  hydrateSelections: (selections) => {
    set((state) => ({
      selections,
      activeStepId: state.steps.length > 0 ? state.steps[0].id : null,
    }))
  },

  reset: () => {
    set((state) => ({
      selections: {},
      activeStepId: state.steps.length > 0 ? state.steps[0].id : null,
      budget: ""
    }))
  }
    }),
    {
      name: "pc-builder-storage",
      version: 1, // Bump version to clear old (incompatible) state
      partialize: (state) => ({ selections: state.selections, budget: state.budget }),
    }
  )
)

