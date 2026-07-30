import { create } from "zustand"
import { PcBuilderStepConfig } from "@/app/admin/(panel)/pc-builder/actions"

export type BuilderProduct = {
  id: number
  name: string
  price: number
  image?: string
  attributes: { attributeId: number, attributeName: string, valueId: number, valueName: string }[]
}

interface NewBuilderState {
  steps: PcBuilderStepConfig[]
  selections: Record<string, BuilderProduct> // stepId -> selected product
  activeStepId: string | null
  budget: string // stored as string for input field
  
  setSteps: (steps: PcBuilderStepConfig[]) => void
  selectProduct: (stepId: string, product: BuilderProduct) => void
  removeProduct: (stepId: string) => void
  setActiveStep: (stepId: string) => void
  setBudget: (budget: string) => void
  getTotalPrice: () => number
  reset: () => void
}

export const useNewBuilderStore = create<NewBuilderState>((set, get) => ({
  steps: [],
  selections: {},
  activeStepId: null,
  budget: "",

  setSteps: (steps) => {
    set({ steps, activeStepId: steps.length > 0 ? steps[0].id : null })
  },

  selectProduct: (stepId, product) => {
    set((state) => {
      const newSelections = { ...state.selections, [stepId]: product }
      
      // Auto-advance to next step if available
      const currentIndex = state.steps.findIndex(s => s.id === stepId)
      let nextStepId = state.activeStepId
      if (currentIndex !== -1 && currentIndex < state.steps.length - 1) {
        nextStepId = state.steps[currentIndex + 1].id
      }
      
      return { selections: newSelections, activeStepId: nextStepId }
    })
  },

  removeProduct: (stepId) => {
    set((state) => {
      const newSelections = { ...state.selections }
      delete newSelections[stepId]
      
      // When a product is removed, also remove dependencies that rely on it to prevent invalid builds
      const stepsToClear = new Set<string>()
      state.steps.forEach(s => {
        if (s.dependSteps?.includes(stepId)) {
          stepsToClear.add(s.id)
        }
      })
      
      stepsToClear.forEach(id => {
        delete newSelections[id]
      })
      
      return { selections: newSelections }
    })
  },

  setActiveStep: (stepId) => set({ activeStepId: stepId }),
  
  setBudget: (budget) => set({ budget }),

  getTotalPrice: () => {
    const { selections } = get()
    return Object.values(selections).reduce((total, product) => total + (product?.price || 0), 0)
  },

  reset: () => {
    set((state) => ({
      selections: {},
      activeStepId: state.steps.length > 0 ? state.steps[0].id : null,
      budget: ""
    }))
  }
}))
