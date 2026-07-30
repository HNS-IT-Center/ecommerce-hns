"use client"

import * as React from "react"
import { motion, Reorder, useDragControls } from "framer-motion"
import { GripVertical, Trash2, Plus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PcBuilderStepConfig } from "../actions"
import { Checkbox } from "@/components/ui/checkbox"

interface StepCardProps {
  step: PcBuilderStepConfig
  index: number
  updateStep: (index: number, step: Partial<PcBuilderStepConfig>) => void
  removeStep: (index: number) => void
  categories: { id: number, name: string, path: string }[]
  attributes: { id: number, name: string }[]
  allSteps: PcBuilderStepConfig[]
}

export function StepCard({ step, index, updateStep, removeStep, categories, attributes, allSteps }: StepCardProps) {
  const controls = useDragControls()

  const handleCategoryChange = (categoryId: number, checked: boolean) => {
    const current = new Set(step.categoryIds || [])
    if (checked) current.add(categoryId)
    else current.delete(categoryId)
    updateStep(index, { categoryIds: Array.from(current) })
  }

  const handleDependStepChange = (stepId: string, checked: boolean) => {
    const current = new Set(step.dependSteps || [])
    if (checked) current.add(stepId)
    else current.delete(stepId)
    updateStep(index, { dependSteps: Array.from(current) })
  }

  const handleDependAttributeChange = (attrId: number, checked: boolean) => {
    const current = new Set(step.dependAttributes || [])
    if (checked) current.add(attrId)
    else current.delete(attrId)
    updateStep(index, { dependAttributes: Array.from(current) })
  }

  // Filter out current step from dependencies
  const availableSteps = allSteps.filter(s => s.id !== step.id && s.name.trim() !== "")

  return (
    <Reorder.Item
      value={step}
      id={step.id}
      dragListener={false}
      dragControls={controls}
      className="list-none mb-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-border/50 shadow-sm overflow-hidden group">
        <div className="flex">
          {/* Drag Handle */}
          <div 
            className="w-10 bg-muted/30 flex flex-col items-center justify-center border-r border-border/30 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
            onPointerDown={(e) => controls.start(e)}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            <div className="mt-2 text-xs font-bold text-muted-foreground">{index + 1}</div>
          </div>
          
          <div className="flex-1 p-5">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Step Name</label>
                <Input 
                  value={step.name} 
                  onChange={(e) => updateStep(index, { name: e.target.value })}
                  placeholder="e.g. Processor, Motherboard, RAM..." 
                  className="font-medium text-lg h-10"
                />
              </div>
              <Button 
                variant="destructive" 
                size="icon" 
                className="opacity-0 group-hover:opacity-100 transition-opacity h-10 w-10 shrink-0"
                onClick={() => removeStep(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Category Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold flex items-center gap-2">
                  1. Target Categories
                </label>
                <div className="h-48 overflow-y-auto pr-2 space-y-2 border rounded-md p-3 bg-muted/10">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-start space-x-2">
                      <Checkbox 
                        id={`cat-${step.id}-${cat.id}`} 
                        checked={(step.categoryIds || []).includes(cat.id)}
                        onCheckedChange={(c) => handleCategoryChange(cat.id, c === true)}
                      />
                      <label htmlFor={`cat-${step.id}-${cat.id}`} className="text-sm leading-tight cursor-pointer hover:text-primary">
                        {cat.name}
                        <div className="text-[10px] text-muted-foreground truncate" title={cat.path}>
                          {cat.path.split(' > ').pop()}
                        </div>
                      </label>
                    </div>
                  ))}
                  {categories.length === 0 && <p className="text-xs text-muted-foreground">No categories found.</p>}
                </div>
              </div>

              {/* Step Dependency */}
              <div className="space-y-3">
                <label className="text-sm font-semibold flex items-center gap-2">
                  2. Depends On (Steps)
                </label>
                <div className="h-48 overflow-y-auto pr-2 space-y-2 border rounded-md p-3 bg-muted/10">
                  {availableSteps.length > 0 ? availableSteps.map(s => (
                    <div key={s.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`dep-${step.id}-${s.id}`} 
                        checked={(step.dependSteps || []).includes(s.id)}
                        onCheckedChange={(c) => handleDependStepChange(s.id, c === true)}
                      />
                      <label htmlFor={`dep-${step.id}-${s.id}`} className="text-sm cursor-pointer hover:text-primary font-medium">
                        {s.name}
                      </label>
                    </div>
                  )) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-2">
                      <AlertCircle className="h-8 w-8 opacity-20" />
                      <p className="text-xs">Create more steps to set dependencies.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attribute Dependency */}
              <div className="space-y-3">
                <label className="text-sm font-semibold flex items-center gap-2">
                  3. Matching Attributes
                </label>
                <div className="h-48 overflow-y-auto pr-2 space-y-2 border rounded-md p-3 bg-muted/10">
                  {attributes.map(attr => (
                    <div key={attr.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`attr-${step.id}-${attr.id}`} 
                        checked={(step.dependAttributes || []).includes(attr.id)}
                        onCheckedChange={(c) => handleDependAttributeChange(attr.id, c === true)}
                      />
                      <label htmlFor={`attr-${step.id}-${attr.id}`} className="text-sm cursor-pointer hover:text-primary">
                        {attr.name}
                      </label>
                    </div>
                  ))}
                  {attributes.length === 0 && <p className="text-xs text-muted-foreground">No attributes found.</p>}
                </div>
              </div>

            </div>
          </div>
        </div>
      </Card>
    </Reorder.Item>
  )
}
