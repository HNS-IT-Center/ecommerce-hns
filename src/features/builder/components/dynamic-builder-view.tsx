"use client"

import { useEffect, useState, useMemo } from "react"
import { useNewBuilderStore, BuilderProduct } from "@/store/new-builder"
import { PcBuilderStepConfig } from "@/app/admin/(panel)/pc-builder/actions"
import { formatRupiah } from "@/lib/utils"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { fetchBuilderProducts } from "../actions"
import { ProductCardBuilder } from "./product-card-builder"
import { Check, Edit2, MessageCircle, Printer, Search, X, Loader2, AlertTriangle, RotateCcw, Menu, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToastManager } from "@/components/ui/toast"
import { motion, AnimatePresence } from "framer-motion"

type DynamicBuilderViewProps = {
  stepsConfig: PcBuilderStepConfig[]
  whatsappNumber: string
}

export function DynamicBuilderView({ stepsConfig, whatsappNumber }: DynamicBuilderViewProps) {
  const { 
    steps, setSteps, selections, activeStepId, setActiveStep, 
    selectProduct, removeProduct, updateQuantity, getTotalPrice, clearSelections
  } = useNewBuilderStore()

  const [mounted, setMounted] = useState(false)
  const [products, setProducts] = useState<BuilderProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [sortMode, setSortMode] = useState<"default" | "name_asc" | "name_desc" | "price_asc" | "price_desc">("default")
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(true)
  const toastManager = useToastManager()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (stepsConfig && stepsConfig.length > 0 && steps.length === 0) {
      setSteps(stepsConfig)
    }
  }, [stepsConfig, setSteps, steps.length])

  const activeStep = steps.find(s => s.id === activeStepId)
  const activeStepIndex = steps.findIndex(s => s.id === activeStepId)

  // Determine dependencies (bidirectional)
  const requiredAttributeValueIds = useMemo(() => {
    const req: number[] = []
    if (activeStep) {
      activeStep.dependSteps?.forEach(depStepId => {
        const stepSels = Array.isArray(selections[depStepId]) ? selections[depStepId] : []
        stepSels.forEach(sel => {
          sel.product.attributes.forEach(attr => {
            if (activeStep.dependAttributes?.includes(attr.attributeId)) {
              req.push(attr.valueId)
            }
          })
        })
      })

      steps.forEach(otherStep => {
        if (otherStep.id !== activeStep.id && otherStep.dependSteps?.includes(activeStep.id)) {
          const stepSels = Array.isArray(selections[otherStep.id]) ? selections[otherStep.id] : []
          stepSels.forEach(sel => {
            sel.product.attributes.forEach(attr => {
              if (otherStep.dependAttributes?.includes(attr.attributeId)) {
                req.push(attr.valueId)
              }
            })
          })
        }
      })
    }
    return req
  }, [activeStep, selections, steps])

  const reqAttrIdsStr = requiredAttributeValueIds.join(",");

  const configuredAttributeIds = useMemo(() => {
    const ids = new Set<number>()
    steps.forEach(s => {
      s.dependAttributes?.forEach(id => ids.add(id))
    })
    return Array.from(ids)
  }, [steps])
  const configuredAttrIdsStr = configuredAttributeIds.join(",")

  useEffect(() => {
    if (!activeStep) return

    let isMountedLocal = true
    if (page === 1) setLoading(true)
    else setLoadingMore(true)

    fetchBuilderProducts({
      categoryIds: activeStep.categoryIds || [],
      requiredAttributeValueIds,
      configuredAttributeIds,
      searchQuery: debouncedSearch,
      limit: 20,
      page,
      sort: sortMode
    }).then(data => {
      if (isMountedLocal) {
        if (page === 1) {
          setProducts(data.products)
        } else {
          setProducts(prev => [...prev, ...data.products])
        }
        setHasMore(data.hasMore)
        setLoading(false)
        setLoadingMore(false)
      }
    }).catch(e => {
      console.error(e)
      if (isMountedLocal) {
        setLoading(false)
        setLoadingMore(false)
      }
    })

    return () => { isMountedLocal = false }
  }, [activeStep?.id, debouncedSearch, reqAttrIdsStr, configuredAttrIdsStr, page, sortMode])

  useEffect(() => {
    setPage(1)
  }, [activeStepId, sortMode])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground/30" />
      </div>
    )
  }

  const validateRequiredSteps = () => {
    const missingSteps = steps.filter(s => s.isRequired && (!Array.isArray(selections[s.id]) || selections[s.id].length === 0))
    if (missingSteps.length > 0) {
      toastManager.add({ 
        title: "Lengkapi Komponen", 
        description: `Silakan pilih komponen untuk: ${missingSteps.map(s => s.name).join(", ")}` 
      })
      return false
    }
    return true
  }

  const handlePrint = () => {
    if (validateRequiredSteps()) window.print()
  }

  const handleCheckoutWA = () => {
    if (!validateRequiredSteps()) return
    let message = "Halo HNS IT Center, saya ingin merakit PC dengan spesifikasi berikut:\n\n"
    steps.forEach((step) => {
      const stepSels = selections[step.id]
      if (Array.isArray(stepSels) && stepSels.length > 0) {
        stepSels.forEach(sel => {
          message += `- ${step.name}: ${sel.product.name} x${sel.quantity} (${formatRupiah(sel.product.price)})\n`
        })
      }
    })
    message += `\n*Estimasi Harga: ${formatRupiah(getTotalPrice())}*\n\n`
    message += "Mohon info ketersediaan barang dan biaya rakit. Terima kasih."
    window.open(buildWhatsAppUrl(whatsappNumber, message), "_blank")
  }

  const selectedStepsCount = steps.filter(s => Array.isArray(selections[s.id]) && selections[s.id].length > 0).length
  const totalSteps = steps.length

  // Sort selected items to top
  const activeStepSelections = activeStep ? (Array.isArray(selections[activeStep.id]) ? selections[activeStep.id] : []) : []
  const selectedProductIds = new Set(activeStepSelections.map(s => s.product.id))
  
  const sortedProducts = [...products].sort((a, b) => {
    const aSelected = selectedProductIds.has(a.id)
    const bSelected = selectedProductIds.has(b.id)
    if (aSelected && !bSelected) return -1
    if (!aSelected && bSelected) return 1
    return 0
  })

  const renderStepsList = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-bold text-lg">Build Progress</h2>
        <button 
          onClick={() => {
            if (window.confirm("Apakah Anda yakin ingin mereset semua pilihan komponen rakitan PC ini?")) {
              clearSelections();
            }
          }}
          className="text-xs text-muted-foreground hover:text-red-500 bg-background hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-sm border border-border/50"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>
      <div className="space-y-3 pb-24 md:pb-0">
        {steps.map((step, index) => {
          const stepSels = selections[step.id]
          const isSelected = Array.isArray(stepSels) && stepSels.length > 0
          const isActive = activeStepId === step.id

          let btnClass = "w-full text-left px-4 py-3 rounded-xl border flex flex-col transition-all cursor-pointer "
          if (isActive) btnClass += "bg-blue-50 border-blue-200 shadow-sm dark:bg-blue-900/20 dark:border-blue-800 "
          else if (isSelected) btnClass += "bg-brand-green/5 border-brand-green/20 hover:bg-brand-green/10 "
          else btnClass += "bg-background border-border/50 hover:bg-accent hover:border-accent-foreground/20 "

          return (
            <button
              key={step.id}
              onClick={() => {
                setActiveStep(step.id)
                if (window.innerWidth < 768) {
                  setIsMobileDrawerOpen(false)
                }
              }}
              className={btnClass}
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0 ${
                  isSelected ? "bg-brand-green text-white" : isActive ? "bg-blue-600 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                }`}>
                  {isSelected ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : (index + 1)}
                </div>
                <div>
                  <div className={`font-semibold text-sm flex items-center gap-1 ${isActive ? "text-blue-700 dark:text-blue-400" : isSelected ? "text-brand-green" : ""}`}>
                    {step.name} {step.isRequired && <span className="text-red-500" title="Required">*</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {isSelected ? `${stepSels.length} Terpilih` : "Pilih komponen"}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto w-full pb-4 md:pb-0">
      
      {/* MOBILE DRAWER TOGGLE (Hidden on Desktop) */}
      <div className="fixed bottom-32 right-4 z-[60] md:hidden print:hidden">
        <Button 
          onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
          className="rounded-full shadow-xl bg-blue-600 hover:bg-blue-700 h-14 w-14 p-0 flex items-center justify-center"
        >
          {isMobileDrawerOpen ? <XCircle className="h-6 w-6 text-white" /> : <Check className="h-6 w-6 text-white" />}
        </Button>
      </div>

      {/* DESKTOP SIDEBAR: Steps Progress */}
      <div className="hidden md:block w-full lg:w-64 shrink-0 print:hidden">
        <div className="sticky top-24 bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          {renderStepsList()}
        </div>
      </div>

      {/* MOBILE SIDEBAR: Steps Progress */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <motion.div 
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-x-0 bottom-0 z-[55] bg-card rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-border/50 p-5 max-h-[80vh] overflow-y-auto md:hidden print:hidden"
          >
            {renderStepsList()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY FOR MOBILE DRAWER */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[50] md:hidden"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* MAIN CONTENT: Products */}
      <div className="flex-1 min-w-0 print:w-full">
        <div className="mb-6 print:hidden">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {activeStep ? activeStep.name : "Memuat..."}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Menampilkan komponen yang kompatibel dengan rakitan Anda.
          </p>
        </div>

        {/* DESKTOP SEARCH AND SORT (Hidden on mobile) */}
        {activeStep && (
          <div className="mb-6 hidden md:flex gap-3 print:hidden">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Cari ${activeStep.name}...`} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-card border-border/50"
              />
            </div>
            <button 
              onClick={() => {
                if (sortMode === "name_asc") setSortMode("name_desc")
                else if (sortMode === "name_desc") setSortMode("default")
                else setSortMode("name_asc")
              }}
              className="px-4 h-10 bg-black text-white rounded-xl text-xs font-bold dark:bg-white dark:text-black hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Sort by Alphabet {sortMode === "name_asc" ? "(A-Z)" : sortMode === "name_desc" ? "(Z-A)" : ""}
            </button>
            <button 
              onClick={() => {
                if (sortMode === "price_asc") setSortMode("price_desc")
                else if (sortMode === "price_desc") setSortMode("default")
                else setSortMode("price_asc")
              }}
              className="px-4 h-10 bg-black text-white rounded-xl text-xs font-bold dark:bg-white dark:text-black hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Sort by Price {sortMode === "price_asc" ? "(Low)" : sortMode === "price_desc" ? "(High)" : ""}
            </button>
          </div>
        )}

        {/* MOBILE FLOATING NAVBAR (Pill) FOR SEARCH & SORT */}
        {activeStep && (
          <div className="md:hidden fixed top-0 left-0 right-0 z-[45] p-4 pointer-events-none">
            <div className="bg-background/80 backdrop-blur-xl border shadow-lg rounded-2xl p-3 pointer-events-auto flex flex-col gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={`Cari ${activeStep.name}...`} 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 rounded-xl bg-card border-border/50 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (sortMode === "name_asc") setSortMode("name_desc")
                    else if (sortMode === "name_desc") setSortMode("default")
                    else setSortMode("name_asc")
                  }}
                  className="flex-1 h-8 bg-muted text-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 transition-opacity whitespace-nowrap"
                >
                  A-Z {sortMode === "name_asc" ? "↓" : sortMode === "name_desc" ? "↑" : ""}
                </button>
                <button 
                  onClick={() => {
                    if (sortMode === "price_asc") setSortMode("price_desc")
                    else if (sortMode === "price_desc") setSortMode("default")
                    else setSortMode("price_asc")
                  }}
                  className="flex-1 h-8 bg-muted text-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 transition-opacity whitespace-nowrap"
                >
                  Price {sortMode === "price_asc" ? "↓" : sortMode === "price_desc" ? "↑" : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add padding top on mobile to account for the floating navbar */}
        <div className="md:mt-0 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="w-10 h-10 animate-spin text-muted-foreground/30" />
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border/50">
              <h3 className="text-lg font-bold">Tidak ada komponen ditemukan</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                Coba kurangi kata kunci pencarian atau mungkin stok komponen sedang kosong.
              </p>
            </div>
          ) : (
            <div className="space-y-6 print:hidden">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {sortedProducts.map(product => {
                  const sel = activeStepSelections.find(s => s.product.id === product.id)
                  const quantity = sel ? sel.quantity : 0
                  return (
                    <ProductCardBuilder 
                      key={product.id}
                      product={product}
                      quantity={quantity}
                      onSelect={() => {
                        selectProduct(activeStep!.id, product)
                        toastManager.add({
                          title: "Komponen Ditambahkan",
                          description: `${product.name} berhasil dipilih.`,
                          variant: "success"
                        })
                      }}
                      onUpdateQuantity={(q) => updateQuantity(activeStep!.id, product.id, q)}
                      displayAttributeIds={configuredAttributeIds}
                    />
                  )
                })}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <Button 
                    variant="outline" 
                    className="rounded-xl px-8 h-12 font-bold hover:bg-accent"
                    onClick={() => setPage(p => p + 1)}
                    disabled={loadingMore}
                  >
                    {loadingMore && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Print-only layout */}
        <div className="hidden print:block w-full">
          <h1 className="text-2xl font-bold mb-4">PC Builder Custom - HNS IT Center</h1>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2">Komponen</th>
                <th className="py-2">Nama Produk</th>
                <th className="py-2 text-right">Harga</th>
              </tr>
            </thead>
            <tbody>
              {steps.map(step => {
                const stepSels = selections[step.id]
                if (!Array.isArray(stepSels) || stepSels.length === 0) {
                  return (
                    <tr key={step.id} className="border-b border-gray-300">
                      <td className="py-3 font-semibold">{step.name}</td>
                      <td className="py-3">-</td>
                      <td className="py-3 text-right">-</td>
                    </tr>
                  )
                }
                return stepSels.map((sel, idx) => (
                  <tr key={`${step.id}-${idx}`} className="border-b border-gray-300">
                    <td className="py-3 font-semibold">{idx === 0 ? step.name : ""}</td>
                    <td className="py-3">{sel.product.name} x{sel.quantity}</td>
                    <td className="py-3 text-right">{formatRupiah(sel.product.price * sel.quantity)}</td>
                  </tr>
                ))
              })}
              <tr>
                <td colSpan={2} className="py-4 font-bold text-right text-lg">Total Estimasi:</td>
                <td className="py-4 font-bold text-right text-lg">{formatRupiah(getTotalPrice())}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* RIGHT SIDEBAR: Summary */}
      <div className="w-full lg:w-72 shrink-0 print:hidden">
        <div className="sticky top-24 space-y-6">
          <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-5">
            <h2 className="font-bold text-lg mb-4">My Build</h2>
            
            <div className="space-y-3 mb-6">
              {steps.map(step => {
                const stepSels = selections[step.id]
                if (!Array.isArray(stepSels) || stepSels.length === 0) return null
                return stepSels.map((sel, idx) => (
                  <div key={`${step.id}-${idx}`} className="p-3 bg-muted/30 rounded-xl border border-border/50 relative group">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{step.name}</div>
                      <div className="text-xs font-bold">{formatRupiah(sel.product.price * sel.quantity)}</div>
                    </div>
                    <div className="text-sm font-semibold leading-snug mb-3">
                      {sel.product.name} <span className="text-muted-foreground ml-1">x{sel.quantity}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setActiveStep(step.id)} className="text-blue-600 hover:text-blue-800 p-1">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeProduct(step.id, sel.product.id)} className="text-red-500 hover:text-red-700 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              })}
              {selectedStepsCount === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground italic">
                  Belum ada komponen yang dipilih.
                </div>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
                <span className="text-lg font-black text-sale-red">{formatRupiah(getTotalPrice())}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Components selected</span>
                <span className="font-bold">{selectedStepsCount}/{totalSteps}</span>
              </div>
            </div>

            <Button onClick={() => {
              if (activeStepIndex < totalSteps - 1) {
                setActiveStep(steps[activeStepIndex + 1].id)
              }
            }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl mb-3 shadow-md shadow-blue-600/20">
              Continue
            </Button>

            <Button onClick={handleCheckoutWA} className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white font-bold h-12 rounded-xl shadow-md shadow-[#25D366]/20 flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Consult with Expert (WA)
            </Button>
            
            <button onClick={handlePrint} className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
