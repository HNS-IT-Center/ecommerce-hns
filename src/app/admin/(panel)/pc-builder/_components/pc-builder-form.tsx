"use client"

import * as React from "react"
import { motion, Reorder, AnimatePresence } from "framer-motion"
import { Plus, Save, Loader2, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  savePcBuilderConfig,
  savePcBuilderDisplayConfig,
} from "../actions"
import {
  type PcBuilderDisplayConfig,
  type PcBuilderStepConfig,
} from "@/lib/pc-builder/config"
import { StepCard } from "./step-card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToastManager } from "@/components/ui/toast"

interface PcBuilderFormProps {
  initialSteps: PcBuilderStepConfig[]
  initialDisplay: PcBuilderDisplayConfig
  categories: { id: number, name: string, path: string }[]
  attributes: { id: number, name: string }[]
}

export function PcBuilderForm({ initialSteps, initialDisplay, categories, attributes }: PcBuilderFormProps) {
  const [steps, setSteps] = React.useState<PcBuilderStepConfig[]>(initialSteps || [])
  const [showItemPrices, setShowItemPrices] = React.useState(initialDisplay.showItemPrices)
  const [isSaving, setIsSaving] = React.useState(false)
  const [showSuccessToast, setShowSuccessToast] = React.useState(false)
  const toastManager = useToastManager()

  const addStep = () => {
    const newStep: PcBuilderStepConfig = {
      id: Math.random().toString(36).substring(7),
      name: "",
      order: steps.length,
      categoryIds: [],
      dependSteps: [],
      dependAttributes: [],
    }
    setSteps([...steps, newStep])
  }

  const updateStep = (index: number, updatedData: Partial<PcBuilderStepConfig>) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], ...updatedData }
    setSteps(newSteps)
  }

  const removeStep = (index: number) => {
    const newSteps = [...steps]
    const removedStep = newSteps[index]
    newSteps.splice(index, 1)
    
    // Clean up dependencies in other steps
    const cleanedSteps = newSteps.map(s => ({
      ...s,
      dependSteps: (s.dependSteps || []).filter(dep => dep !== removedStep.id)
    }))
    
    setSteps(cleanedSteps)
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newSteps = [...steps]
      const temp = newSteps[index]
      newSteps[index] = newSteps[index - 1]
      newSteps[index - 1] = temp
      setSteps(newSteps)
    } else if (direction === 'down' && index < steps.length - 1) {
      const newSteps = [...steps]
      const temp = newSteps[index]
      newSteps[index] = newSteps[index + 1]
      newSteps[index + 1] = temp
      setSteps(newSteps)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Re-assign order based on array position before saving
      const orderedSteps = steps.map((s, i) => ({ ...s, order: i }))
      const serializedSteps = JSON.parse(JSON.stringify(orderedSteps))
      await savePcBuilderConfig(serializedSteps)
      await savePcBuilderDisplayConfig({ showItemPrices })
      setShowSuccessToast(true)
      setTimeout(() => setShowSuccessToast(false), 3000)
    } catch (error) {
      // Galat aslinya ikut dicatat, bukan cuma diganti pesan ramah: tanpa ini
      // kegagalan menyimpan konfigurasi tidak meninggalkan jejak apa pun untuk
      // ditelusuri, dan yang tersisa cuma "Failed to save configuration."
      console.error("Gagal menyimpan konfigurasi PC builder:", error)
      toastManager.add({ title: "Error", description: "Failed to save configuration." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-background/80 backdrop-blur-xl p-5 rounded-2xl border border-white/20 shadow-lg sticky top-20 z-20 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10 mb-4 sm:mb-0">
          <h3 className="font-extrabold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">Steps Configuration</h3>
          <p className="text-sm text-muted-foreground font-medium">Drag to reorder or use arrows. Configure dependencies for each step.</p>
        </div>
        <div className="flex space-x-3 relative z-10 w-full sm:w-auto">
          <Button onClick={addStep} variant="outline" className="gap-2 flex-1 sm:flex-none rounded-xl border-border/50 hover:bg-accent shadow-sm">
            <Plus className="w-4 h-4" /> Add Step
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 flex-1 sm:flex-none rounded-xl shadow-md shadow-primary/20">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </motion.div>

      {/* Pengaturan tampilan dokumen quotation. */}
      <div className="rounded-2xl border border-border/50 bg-background/60 p-5 shadow-sm">
        <h4 className="font-bold text-base">Tampilan PDF Quotation</h4>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Atur apa yang terlihat oleh pelanggan pada dokumen yang dicetak.
        </p>

        <div className="mt-4">
          <p className="text-sm font-semibold mb-2">Harga per item</p>
          <RadioGroup
            value={showItemPrices ? "show" : "hide"}
            onValueChange={(v) => setShowItemPrices(v === "show")}
            className="flex flex-col gap-2 sm:flex-row sm:gap-3"
          >
            <label
              className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                showItemPrices ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40"
              }`}
            >
              <RadioGroupItem value="show" className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold">Tampilkan</span>
                <span className="block text-xs text-muted-foreground">
                  Kolom Harga &amp; Subtotal tiap komponen ikut tercetak.
                </span>
              </span>
            </label>
            <label
              className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                !showItemPrices ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40"
              }`}
            >
              <RadioGroupItem value="hide" className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold">Sembunyikan</span>
                <span className="block text-xs text-muted-foreground">
                  Hanya daftar komponen &amp; Total. Rincian harga tetap bisa dilihat staf
                  lewat kode quotation.
                </span>
              </span>
            </label>
          </RadioGroup>
        </div>
      </div>

      <div className="pt-2 pb-20">
        {steps.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-2xl">
            <h3 className="text-lg font-bold text-muted-foreground">No steps configured yet</h3>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-6">Create your first step to start building the PC Builder flow.</p>
            <Button onClick={addStep} className="rounded-xl shadow-md"><Plus className="w-4 h-4 mr-2" /> Create First Step</Button>
          </div>
        ) : (
          <Reorder.Group values={steps} onReorder={setSteps} className="grid grid-cols-1 2xl:grid-cols-2 gap-5 items-start">
            <AnimatePresence initial={false}>
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  allSteps={steps}
                  updateStep={updateStep}
                  removeStep={removeStep}
                  moveStep={moveStep}
                  categories={categories}
                  attributes={attributes}
                  isFirst={index === 0}
                  isLast={index === steps.length - 1}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>
      
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed top-20 md:top-24 right-4 z-[9999] flex items-center gap-3 rounded-lg bg-card p-4 shadow-xl border border-border"
          >
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-foreground">
              Configuration saved successfully
            </span>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="ml-2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
