"use client"

import * as React from "react"
import { motion, Reorder, useDragControls } from "framer-motion"
import { GripVertical, Trash2, AlertCircle, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PcBuilderStepConfig } from "../actions"
import { Checkbox } from "@/components/ui/checkbox"

interface StepCardProps {
  step: PcBuilderStepConfig
  index: number
  updateStep: (index: number, step: Partial<PcBuilderStepConfig>) => void
  removeStep: (index: number) => void
  moveStep: (index: number, direction: 'up' | 'down') => void
  categories: { id: number, name: string, path: string }[]
  attributes: { id: number, name: string }[]
  allSteps: PcBuilderStepConfig[]
  isFirst: boolean
  isLast: boolean
}

export function StepCard({ step, index, updateStep, removeStep, moveStep, categories, attributes, allSteps, isFirst, isLast }: StepCardProps) {
  const controls = useDragControls()
  const [isFolded, setIsFolded] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  
  const [catSearch, setCatSearch] = React.useState("")
  const [depStepSearch, setDepStepSearch] = React.useState("")
  const [attrSearch, setAttrSearch] = React.useState("")

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

  const availableSteps = allSteps.filter(s => s.id !== step.id && s.name.trim() !== "")
  
  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()) || c.path.toLowerCase().includes(catSearch.toLowerCase()))
  const filteredSteps = availableSteps.filter(s => s.name.toLowerCase().includes(depStepSearch.toLowerCase()))
  const filteredAttributes = attributes.filter(a => a.name.toLowerCase().includes(attrSearch.toLowerCase()))

  const selectedCategories = filteredCategories.filter(cat => (step.categoryIds || []).includes(cat.id))
  const unselectedCategories = filteredCategories.filter(cat => !(step.categoryIds || []).includes(cat.id))

  const selectedSteps = filteredSteps.filter(s => (step.dependSteps || []).includes(s.id))
  const unselectedSteps = filteredSteps.filter(s => !(step.dependSteps || []).includes(s.id))

  const selectedAttributes = filteredAttributes.filter(a => (step.dependAttributes || []).includes(a.id))
  const unselectedAttributes = filteredAttributes.filter(a => !(step.dependAttributes || []).includes(a.id))

  return (
    <Reorder.Item
      value={step}
      id={step.id}
      dragListener={false}
      dragControls={controls}
      className="list-none"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      whileDrag={{ scale: 1.02, zIndex: 50 }}
    >
      <Card className="border-none bg-background/60 backdrop-blur-xl shadow-lg hover:shadow-2xl hover:bg-background/80 transition-all duration-300 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Drag Handle & Order controls */}
          <div className="w-full sm:w-12 bg-muted/20 flex sm:flex-col items-center justify-center sm:border-r border-b sm:border-b-0 border-border/10 gap-2 p-2 sm:p-0">
            <div 
              className="p-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-md transition-colors"
              onPointerDown={(e) => controls.start(e)}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground/70" />
            </div>
            <div className="flex sm:flex-col gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/70" disabled={isFirst} onClick={() => moveStep(index, 'up')}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <div className="text-[10px] font-black text-center text-muted-foreground/70 w-6 flex items-center justify-center">{index + 1}</div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/70" disabled={isLast} onClick={() => moveStep(index, 'down')}>
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 p-5">
            {/* Header / Main Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1 w-full space-y-1">
                <Input 
                  value={step.name} 
                  onChange={(e) => updateStep(index, { name: e.target.value })}
                  placeholder="e.g. Processor, Motherboard, RAM..." 
                  className="font-bold text-lg h-12 bg-background/40 shadow-inner rounded-xl border-border/20 focus-visible:ring-1"
                />
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-background/40 p-2 rounded-xl border border-border/20">
                <div className="flex items-center space-x-2 px-2">
                  <Checkbox 
                    id={`req-${step.id}`} 
                    checked={step.isRequired || false}
                    onCheckedChange={(c) => updateStep(index, { isRequired: c === true })}
                  />
                  <label htmlFor={`req-${step.id}`} className="text-sm font-semibold cursor-pointer">Required</label>
                </div>
                <div className="flex items-center space-x-2 px-2 border-l border-border/30 pl-3">
                  <Checkbox 
                    id={`mul-${step.id}`} 
                    checked={step.allowMultiple || false}
                    onCheckedChange={(c) => updateStep(index, { allowMultiple: c === true })}
                  />
                  <label htmlFor={`mul-${step.id}`} className="text-sm font-semibold cursor-pointer">Allow Multiple</label>
                </div>
                <div className="h-6 w-px bg-border/30"></div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsFolded(!isFolded)}
                  className="h-8 w-8 rounded-lg hover:bg-muted/50"
                >
                  {isFolded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-1">
                    <Button variant="destructive" size="sm" className="h-8 text-xs font-bold px-2 rounded-lg shadow-md" onClick={() => removeStep(index)}>Confirm</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs px-2 rounded-lg hover:bg-muted/50" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg text-red-500 hover:text-white hover:bg-red-500 transition-colors"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Foldable Content */}
            <motion.div 
              initial={false}
              animate={{ height: isFolded ? 0 : "auto", opacity: isFolded ? 0 : 1, marginTop: isFolded ? 0 : 24 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-background/40 p-4 rounded-xl shadow-inner border border-border/10">
                
                {/* Category Selection */}
                <div className="space-y-3 flex flex-col h-64">
                  <label className="text-sm font-bold flex items-center text-primary">1. Target Categories</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
                    <Input 
                      placeholder="Search categories..." 
                      className="h-8 pl-8 text-xs bg-muted/20 border-border/30" 
                      value={catSearch}
                      onChange={e => setCatSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 rounded-md p-2 bg-muted/10 border border-border/20">
                    {/* Selected Categories */}
                    {selectedCategories.map(cat => {
                      const pathParts = cat.path.split(' > ')
                      const parentPath = pathParts.slice(0, -1).join(' > ')
                      const currentName = pathParts[pathParts.length - 1]
                      return (
                        <div key={cat.id} className="flex items-start space-x-2 py-1">
                          <Checkbox 
                            id={`cat-${step.id}-${cat.id}`} 
                            checked={true}
                            onCheckedChange={(c) => handleCategoryChange(cat.id, c === true)}
                            className="mt-1 border-primary/30"
                          />
                          <label htmlFor={`cat-${step.id}-${cat.id}`} className="flex flex-col cursor-pointer hover:text-primary">
                            <span className="text-sm font-semibold leading-none">{currentName}</span>
                            {parentPath && <span className="text-[10px] text-muted-foreground mt-0.5">{parentPath}</span>}
                          </label>
                        </div>
                      )
                    })}
                    
                    {/* Divider */}
                    {selectedCategories.length > 0 && unselectedCategories.length > 0 && (
                      <hr className="my-2 border-border/30" />
                    )}

                    {/* Unselected Categories */}
                    {unselectedCategories.map(cat => {
                      const pathParts = cat.path.split(' > ')
                      const parentPath = pathParts.slice(0, -1).join(' > ')
                      const currentName = pathParts[pathParts.length - 1]
                      return (
                        <div key={cat.id} className="flex items-start space-x-2 py-1">
                          <Checkbox 
                            id={`cat-${step.id}-${cat.id}`} 
                            checked={false}
                            onCheckedChange={(c) => handleCategoryChange(cat.id, c === true)}
                            className="mt-1 border-primary/30"
                          />
                          <label htmlFor={`cat-${step.id}-${cat.id}`} className="flex flex-col cursor-pointer hover:text-primary">
                            <span className="text-sm font-semibold leading-none">{currentName}</span>
                            {parentPath && <span className="text-[10px] text-muted-foreground mt-0.5">{parentPath}</span>}
                          </label>
                        </div>
                      )
                    })}
                    {filteredCategories.length === 0 && <p className="text-xs text-muted-foreground/50 p-2">No categories found.</p>}
                  </div>
                </div>

                {/* Step Dependency */}
                <div className="space-y-3 flex flex-col h-64">
                  <label className="text-sm font-bold flex items-center text-primary">2. Depends On (Steps)</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
                    <Input 
                      placeholder="Search steps..." 
                      className="h-8 pl-8 text-xs bg-muted/20 border-border/30" 
                      value={depStepSearch}
                      onChange={e => setDepStepSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 rounded-md p-2 bg-muted/10 border border-border/20">
                    {/* Selected Steps */}
                    {selectedSteps.map(s => (
                      <div key={s.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`dep-${step.id}-${s.id}`} 
                          checked={true}
                          onCheckedChange={(c) => handleDependStepChange(s.id, c === true)}
                          className="border-primary/30"
                        />
                        <label htmlFor={`dep-${step.id}-${s.id}`} className="text-sm font-medium cursor-pointer hover:text-primary">
                          {s.name}
                        </label>
                      </div>
                    ))}

                    {/* Divider */}
                    {selectedSteps.length > 0 && unselectedSteps.length > 0 && (
                      <hr className="my-2 border-border/30" />
                    )}

                    {/* Unselected Steps */}
                    {unselectedSteps.map(s => (
                      <div key={s.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`dep-${step.id}-${s.id}`} 
                          checked={false}
                          onCheckedChange={(c) => handleDependStepChange(s.id, c === true)}
                          className="border-primary/30"
                        />
                        <label htmlFor={`dep-${step.id}-${s.id}`} className="text-sm font-medium cursor-pointer hover:text-primary">
                          {s.name}
                        </label>
                      </div>
                    ))}
                    
                    {filteredSteps.length === 0 && availableSteps.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/50 space-y-2">
                        <AlertCircle className="h-6 w-6 opacity-50" />
                        <p className="text-[10px]">No steps available.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attribute Dependency */}
                <div className="space-y-3 flex flex-col h-64">
                  <label className="text-sm font-bold flex items-center text-primary">3. Matching Attributes</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
                    <Input 
                      placeholder="Search attributes..." 
                      className="h-8 pl-8 text-xs bg-muted/20 border-border/30" 
                      value={attrSearch}
                      onChange={e => setAttrSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 rounded-md p-2 bg-muted/10 border border-border/20">
                    {/* Selected Attributes */}
                    {selectedAttributes.map(attr => (
                      <div key={attr.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`attr-${step.id}-${attr.id}`} 
                          checked={true}
                          onCheckedChange={(c) => handleDependAttributeChange(attr.id, c === true)}
                          className="border-primary/30"
                        />
                        <label htmlFor={`attr-${step.id}-${attr.id}`} className="text-sm font-medium cursor-pointer hover:text-primary">
                          {attr.name}
                        </label>
                      </div>
                    ))}

                    {/* Divider */}
                    {selectedAttributes.length > 0 && unselectedAttributes.length > 0 && (
                      <hr className="my-2 border-border/30" />
                    )}

                    {/* Unselected Attributes */}
                    {unselectedAttributes.map(attr => (
                      <div key={attr.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`attr-${step.id}-${attr.id}`} 
                          checked={false}
                          onCheckedChange={(c) => handleDependAttributeChange(attr.id, c === true)}
                          className="border-primary/30"
                        />
                        <label htmlFor={`attr-${step.id}-${attr.id}`} className="text-sm font-medium cursor-pointer hover:text-primary">
                          {attr.name}
                        </label>
                      </div>
                    ))}

                    {filteredAttributes.length === 0 && <p className="text-xs text-muted-foreground/50 p-2">No attributes found.</p>}
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        </div>
      </Card>
    </Reorder.Item>
  )
}
