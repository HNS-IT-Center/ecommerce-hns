"use client"

import { useEffect, useState, useMemo } from "react"
import { useNewBuilderStore, BuilderProduct } from "@/store/new-builder"
import { PcBuilderStepConfig } from "@/app/admin/(panel)/pc-builder/actions"
import { formatRupiah } from "@/lib/utils"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { fetchBuilderProducts } from "../actions"
import { ProductCardBuilder } from "./product-card-builder"
import { Check, Edit2, Lock, MessageCircle, Printer, Search, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type DynamicBuilderViewProps = {
  stepsConfig: PcBuilderStepConfig[]
  whatsappNumber: string
}

export function DynamicBuilderView({ stepsConfig, whatsappNumber }: DynamicBuilderViewProps) {
  const { 
    steps, setSteps, selections, activeStepId, setActiveStep, 
    selectProduct, removeProduct, budget, setBudget, getTotalPrice 
  } = useNewBuilderStore()

  const [products, setProducts] = useState<BuilderProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  // Optional: add a debounce for search if needed

  useEffect(() => {
    if (stepsConfig && stepsConfig.length > 0) {
      setSteps(stepsConfig)
    }
  }, [stepsConfig, setSteps])

  const activeStep = steps.find(s => s.id === activeStepId)
  const activeStepIndex = steps.findIndex(s => s.id === activeStepId)

  // Determine dependencies
  const requiredAttributeValueIds = useMemo(() => {
    const req: number[] = []
    if (activeStep) {
      activeStep.dependSteps?.forEach(depStepId => {
        const selectedProd = selections[depStepId]
        if (selectedProd) {
          selectedProd.attributes.forEach(attr => {
            if (activeStep.dependAttributes?.includes(attr.attributeId)) {
              req.push(attr.valueId)
            }
          })
        }
      })
    }
    return req
  }, [activeStep, selections])

  // Fetch products when active step or search changes
  useEffect(() => {
    if (!activeStep) return

    let isMounted = true
    setLoading(true)

    // Check if dependencies are met
    const hasUnmetDependencies = activeStep.dependSteps?.some(depId => !selections[depId])
    if (hasUnmetDependencies) {
      setProducts([])
      setLoading(false)
      return
    }

    fetchBuilderProducts({
      categoryIds: activeStep.categoryIds || [],
      requiredAttributeValueIds,
      searchQuery: search,
      limit: 20
    }).then(data => {
      if (isMounted) {
        setProducts(data)
        setLoading(false)
      }
    }).catch(e => {
      console.error(e)
      if (isMounted) setLoading(false)
    })

    return () => { isMounted = false }
  }, [activeStep, search, requiredAttributeValueIds, selections])

  const handlePrint = () => window.print()

  const handleCheckoutWA = () => {
    let message = "Halo HNS IT Center, saya ingin merakit PC dengan spesifikasi berikut:\n\n"
    steps.forEach((step) => {
      const selected = selections[step.id]
      if (selected) {
        message += `- ${step.name}: ${selected.name} (${formatRupiah(selected.price)})\n`
      }
    })
    message += `\n*Estimasi Harga: ${formatRupiah(getTotalPrice())}*\n\n`
    message += "Mohon info ketersediaan barang dan biaya rakit. Terima kasih."
    window.open(buildWhatsAppUrl(whatsappNumber, message), "_blank")
  }

  const selectedCount = Object.keys(selections).length
  const totalSteps = steps.length
  const progressPercent = totalSteps > 0 ? (selectedCount / totalSteps) * 100 : 0

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto w-full">
      
      {/* LEFT SIDEBAR: Steps Progress */}
      <div className="w-full lg:w-64 shrink-0 print:hidden">
        <div className="sticky top-24 bg-card rounded-2xl p-5 shadow-sm border border-border/50">
          <h2 className="font-bold text-lg mb-6">Build Progress</h2>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isSelected = !!selections[step.id]
              const isActive = activeStepId === step.id
              // Check if dependencies are met
              const isLocked = step.dependSteps?.some(depId => !selections[depId])

              let btnClass = "w-full text-left px-4 py-3 rounded-xl border flex flex-col transition-all "
              if (isActive) btnClass += "bg-blue-50 border-blue-200 shadow-sm dark:bg-blue-900/20 dark:border-blue-800 "
              else if (isSelected) btnClass += "bg-brand-green/5 border-brand-green/20 hover:bg-brand-green/10 "
              else if (isLocked) btnClass += "bg-muted/30 border-dashed border-border/50 opacity-60 cursor-not-allowed "
              else btnClass += "bg-background border-border/50 hover:bg-accent hover:border-accent-foreground/20 "

              return (
                <button
                  key={step.id}
                  onClick={() => !isLocked && setActiveStep(step.id)}
                  disabled={isLocked}
                  className={btnClass}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0 ${
                      isSelected ? "bg-brand-green text-white" : isActive ? "bg-blue-600 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                    }`}>
                      {isSelected ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : isLocked ? <Lock className="w-3 h-3" /> : (index + 1)}
                    </div>
                    <div>
                      <div className={`font-semibold text-sm ${isActive ? "text-blue-700 dark:text-blue-400" : isSelected ? "text-brand-green" : ""}`}>
                        {step.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {isSelected ? "Terpilih" : isLocked ? "Menunggu komponen lain" : "Pilih komponen"}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

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

        {activeStep && (
          <div className="mb-6 flex gap-3 print:hidden">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Cari ${activeStep.name}...`} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-card border-border/50"
              />
            </div>
            {/* Mock filters for UI parity */}
            <button className="px-4 h-10 bg-black text-white rounded-xl text-xs font-bold dark:bg-white dark:text-black">
              Filter by Brand
            </button>
            <button className="px-4 h-10 bg-black text-white rounded-xl text-xs font-bold dark:bg-white dark:text-black">
              Filter by Price
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground/30" />
          </div>
        ) : activeStep?.dependSteps?.some(depId => !selections[depId]) ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border/50">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-bold">Kunci Otomatis</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              Anda harus memilih komponen sebelumnya terlebih dahulu agar kami dapat memfilter kompatibilitasnya.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border/50">
            <h3 className="text-lg font-bold">Tidak ada komponen ditemukan</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              Coba kurangi kata kunci pencarian atau mungkin stok komponen sedang kosong.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 print:hidden">
            {products.map(product => (
              <ProductCardBuilder 
                key={product.id}
                product={product}
                isSelected={selections[activeStep!.id]?.id === product.id}
                onSelect={() => selectProduct(activeStep!.id, product)}
              />
            ))}
          </div>
        )}
        
        {/* Print-only layout (Shows selected items fully expanded instead of grid) */}
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
              {steps.map(step => (
                <tr key={step.id} className="border-b border-gray-300">
                  <td className="py-3 font-semibold">{step.name}</td>
                  <td className="py-3">{selections[step.id]?.name || "-"}</td>
                  <td className="py-3 text-right">{selections[step.id] ? formatRupiah(selections[step.id].price) : "-"}</td>
                </tr>
              ))}
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
                const selected = selections[step.id]
                if (!selected) return null
                return (
                  <div key={step.id} className="p-3 bg-muted/30 rounded-xl border border-border/50">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{step.name}</div>
                      <div className="text-xs font-bold">{formatRupiah(selected.price)}</div>
                    </div>
                    <div className="text-sm font-semibold line-clamp-2 leading-snug mb-3">
                      {selected.name}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setActiveStep(step.id)} className="text-blue-600 hover:text-blue-800 p-1">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeProduct(step.id)} className="text-red-500 hover:text-red-700 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {selectedCount === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground italic">
                  Belum ada komponen yang dipilih.
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="text-xs font-bold text-muted-foreground mb-2 block">Enter Your Budget</label>
              <Input 
                placeholder="Rp 0" 
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="bg-background rounded-xl h-10"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
                <span className="text-lg font-black text-sale-red">{formatRupiah(getTotalPrice())}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Components selected</span>
                <span className="font-bold">{selectedCount}/{totalSteps}</span>
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
