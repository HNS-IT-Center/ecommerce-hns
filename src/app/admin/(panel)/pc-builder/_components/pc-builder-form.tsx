"use client"

import * as React from "react"
import { motion, Reorder, AnimatePresence } from "framer-motion"
import { Plus, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PcBuilderStepConfig, savePcBuilderConfig } from "../actions"
import { StepCard } from "./step-card"
import { useToastManager } from "@/components/ui/toast"

interface PcBuilderFormProps {
  initialSteps: PcBuilderStepConfig[]
  categories: { id: number, name: string, path: string }[]
  attributes: { id: number, name: string }[]
}

export function PcBuilderForm({ initialSteps, categories, attributes }: PcBuilderFormProps) {
  const [steps, setSteps] = React.useState<PcBuilderStepConfig[]>(initialSteps || [])
  const [isSaving, setIsSaving] = React.useState(false)
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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Re-assign order based on array position before saving
      const orderedSteps = steps.map((s, i) => ({ ...s, order: i }))
      await savePcBuilderConfig(orderedSteps)
      toastManager.add({ title: "Success", description: "Configuration saved successfully!" })
    } catch (error) {
      toastManager.add({ title: "Error", description: "Failed to save configuration." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm sticky top-24 z-10">
        <div>
          <h3 className="font-semibold text-lg">Steps Configuration</h3>
          <p className="text-sm text-muted-foreground">Drag to reorder. Configure dependencies for each step.</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={addStep} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Add Step
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="pt-2 pb-20">
        {steps.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-medium text-muted-foreground">No steps configured yet</h3>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-6">Create your first step to start building the PC Builder flow.</p>
            <Button onClick={addStep}><Plus className="w-4 h-4 mr-2" /> Create First Step</Button>
          </div>
        ) : (
          <Reorder.Group axis="y" values={steps} onReorder={setSteps} className="space-y-4">
            <AnimatePresence initial={false}>
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  allSteps={steps}
                  updateStep={updateStep}
                  removeStep={removeStep}
                  categories={categories}
                  attributes={attributes}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>
    </div>
  )
}
