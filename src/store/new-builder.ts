import { create } from "zustand"
import { persist } from "zustand/middleware"
import { PcBuilderStepConfig } from "@/lib/pc-builder/config"

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
  attributes: { attributeId: number, attributeName: string, valueId: number, valueName: string }[]
}

export type BuilderSelection = {
  product: BuilderProduct
  quantity: number
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
  getTotalPrice: () => number
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
    (set, get) => ({
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

        const validOtherSelections = otherStepSelections.filter(otherSel => {
          let isCompatible = true;
          
          if (otherDependsOnCurrent) {
            otherStep.dependAttributes?.forEach(attrId => {
              const valA = otherSel.product.attributes.find(a => a.attributeId === attrId)?.valueId;
              const valB = product.attributes.find(a => a.attributeId === attrId)?.valueId;
              if (valA !== valB) isCompatible = false;
            })
          }
          
          if (currentDependsOnOther) {
            currentStep.dependAttributes?.forEach(attrId => {
              const valA = product.attributes.find(a => a.attributeId === attrId)?.valueId;
              const valB = otherSel.product.attributes.find(a => a.attributeId === attrId)?.valueId;
              if (valA !== valB) isCompatible = false;
            })
          }
          
          return isCompatible;
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

  getTotalPrice: () => {
    const { selections } = get()
    return Object.values(selections).reduce((total, stepSelections) => {
      const stepTotal = stepSelections.reduce((sum, sel) => sum + (sel.product.price * sel.quantity), 0)
      return total + stepTotal
    }, 0)
  },

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

