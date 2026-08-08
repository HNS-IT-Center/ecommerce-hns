"use client"

import { useEffect, useState, useMemo } from "react"
import { useNewBuilderStore, BuilderProduct } from "@/store/new-builder"
import { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import { formatRupiah } from "@/lib/utils"
import { fetchBuilderProducts } from "../actions"
import { prepareBuildWhatsApp } from "../actions-whatsapp"
import { ProductCardBuilder } from "./product-card-builder"
import { Check, Edit2, MessageCircle, Printer, Search, X, Loader2, AlertTriangle, RotateCcw, Menu, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToastManager } from "@/components/ui/toast"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import Stack3Icon from "@/components/icons/stack-icon"
import SaveIcon from "@/components/icons/save-icon"

type DynamicBuilderViewProps = {
  stepsConfig: PcBuilderStepConfig[]
}

/**
 * Nomor WhatsApp tidak lagi dioper dari env: tujuan dan harganya sama-sama
 * dibaca di server lewat `prepareBuildWhatsApp`, dari tabel stores.
 */
export function DynamicBuilderView({ stepsConfig }: DynamicBuilderViewProps) {
  const { 
    steps, setSteps, selections, activeStepId, setActiveStep, 
    selectProduct, removeProduct, updateQuantity, getTotalPrice, clearSelections
  } = useNewBuilderStore()

  const [mounted, setMounted] = useState(false)
  const [sendingWA, setSendingWA] = useState(false)
  const [products, setProducts] = useState<BuilderProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [sortMode, setSortMode] = useState<"default" | "name_asc" | "name_desc" | "price_asc" | "price_desc">("default")
  const [isMobileStepsOpen, setIsMobileStepsOpen] = useState(false)
  const [isMobileMyBuildOpen, setIsMobileMyBuildOpen] = useState(false)
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

  // Determine dependencies (forward only)
  const requiredAttributeValueIds = useMemo(() => {
    const req: number[] = []
    if (activeStep) {
      // Only filter based on parent steps that THIS step depends on
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
    }
    return req
  }, [activeStep, selections])

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
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    // Hanya id & kuantitas yang dikirim — nama, harga, dan gambar dibaca ulang
    // dari database di halaman /build-pc/print, jadi harga yang tampil di PDF
    // tidak bisa dipalsukan lewat inspect element di halaman ini.
    const itemsParam = steps
      .flatMap((step) => {
        const stepSels = selections[step.id]
        if (!Array.isArray(stepSels)) return []
        return stepSels.map((sel) => `${step.id}:${sel.product.id}:${sel.quantity}`)
      })
      .join(",")

    if (itemsParam.length === 0) {
      toastManager.add({
        title: "Build Kosong",
        description: "Belum ada komponen yang dipilih."
      })
      return
    }

    // Navigate to the print page
    window.open(`/build-pc/print?items=${encodeURIComponent(itemsParam)}`, '_blank')
  }

  /**
   * Pesan disusun DI SERVER, dari harga katalog.
   *
   * Sebelumnya pesan dirangkai di sini memakai `sel.product.price` dan
   * `getTotalPrice()` — keduanya berasal dari `hns-builder-storage` di
   * localStorage, yang bisa disunting lewat devtools. Rakitan PC adalah nilai
   * terbesar di situs ini, jadi angkanya harus dibaca ulang dari katalog.
   *
   * Persis pola `handlePrint` di atas, yang sejak awal hanya mengirim id dan
   * kuantitas. Lihat CLAUDE.md §2.7.
   */
  const handleCheckoutWA = async () => {
    if (!validateRequiredSteps()) return
    if (sendingWA) return

    const lines = steps.flatMap((step) => {
      const stepSels = selections[step.id]
      if (!Array.isArray(stepSels)) return []
      return stepSels.map((sel) => ({
        productId: Number(sel.product.id),
        quantity: sel.quantity,
        stepName: step.name,
      }))
    })

    setSendingWA(true)
    try {
      const hasil = await prepareBuildWhatsApp(lines)
      if (!hasil.ok) {
        toastManager.add({
          title: "Gagal menyiapkan pesan",
          description:
            hasil.reason === "all-unavailable"
              ? "Komponen yang dipilih sudah tidak tersedia. Muat ulang halaman ini."
              : hasil.reason === "no-store"
                ? "Nomor WhatsApp CS belum tersedia."
                : "Belum ada komponen yang dipilih.",
        })
        return
      }

      // Komponen yang hilang dari katalog disebutkan, bukan dibuang diam-diam:
      // pelanggan harus tahu rakitannya berangkat tidak lengkap.
      if (hasil.unavailableProductIds.length > 0) {
        toastManager.add({
          title: "Sebagian komponen tidak tersedia",
          description: `${hasil.unavailableProductIds.length} komponen sudah tidak dijual dan tidak ikut dikirim.`,
        })
      }

      window.open(hasil.waUrl, "_blank", "noopener,noreferrer")
    } catch {
      toastManager.add({
        title: "Gagal menyiapkan pesan",
        description: "Coba lagi sebentar lagi.",
      })
    } finally {
      setSendingWA(false)
    }
  }

  const selectedStepsCount = steps.filter(s => Array.isArray(selections[s.id]) && selections[s.id].length > 0).length
  const totalSteps = steps.length

  // Sort selected items to top
  const activeStepSelections = activeStep ? (Array.isArray(selections[activeStep.id]) ? selections[activeStep.id] : []) : []
  const selectedProductIds = new Set(activeStepSelections.map(s => s.product.id))

  /**
   * Komponen yang sudah dipilih SELALU ikut ditampilkan, walau tidak ada di
   * halaman yang sudah dimuat.
   *
   * `products` cuma berisi hasil fetch sejauh ini (20 per halaman), dan halaman
   * pertama MENIMPA isinya. Jadi komponen yang dipilih lewat pencarian, atau
   * yang aslinya ada di halaman ke-3, tidak ada di array ini sama sekali —
   * mengurutkan saja tidak cukup karena tidak ada yang bisa diurutkan. Akibatnya
   * kartunya hilang dari grid dan terlihat seperti belum dipilih sampai tombol
   * "Load More" ditekan berkali-kali.
   *
   * Objek produknya diambil dari store (disimpan utuh saat dipilih), jadi tidak
   * perlu fetch tambahan.
   *
   * Saat sedang mencari, yang disisipkan hanya yang namanya cocok dengan kata
   * kunci — daftar hasil pencarian harus tetap jujur terhadap apa yang diketik,
   * bukan tiba-tiba memunculkan komponen yang tidak ada hubungannya.
   */
  const loadedProductIds = new Set(products.map(p => p.id))
  const searchTerm = debouncedSearch.trim().toLowerCase()
  const selectedButNotLoaded = activeStepSelections
    .filter(s => !loadedProductIds.has(s.product.id))
    .map(s => s.product)
    .filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm))

  const sortedProducts = [...selectedButNotLoaded, ...products].sort((a, b) => {
    const aSelected = selectedProductIds.has(a.id)
    const bSelected = selectedProductIds.has(b.id)
    if (aSelected && !bSelected) return -1
    if (!aSelected && bSelected) return 1
    return 0
  })

  const renderStepsList = () => (
    // Tingginya dibatasi & daftarnya scroll sendiri, mengikuti pola panel
    // My Build supaya kedua sidebar terasa sepadan dan tidak memanjang
    // melebihi layar.
    <div className="flex flex-col max-h-[70vh] md:max-h-[calc(100vh-11rem)] min-h-0">
      <div className="flex items-center justify-between mb-4 shrink-0">
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
      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1 pb-24 md:pb-0">
        {steps.map((step, index) => {
          const stepSels = selections[step.id]
          const isSelected = Array.isArray(stepSels) && stepSels.length > 0
          const isActive = activeStepId === step.id

          let btnClass = "w-full text-left px-3 py-2.5 rounded-lg border flex flex-col transition-all cursor-pointer "
          if (isActive) btnClass += "bg-blue-50 border-blue-200 shadow-sm dark:bg-blue-900/20 dark:border-blue-800 "
          else if (isSelected) btnClass += "bg-brand-green/5 border-brand-green/20 hover:bg-brand-green/10 "
          else btnClass += "bg-background border-border/50 hover:bg-accent hover:border-accent-foreground/20 "

          return (
            <button
              key={step.id}
              onClick={() => {
                setActiveStep(step.id)
                if (window.innerWidth < 768) {
                  setIsMobileStepsOpen(false)
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
    </div>
  )

  const renderMyBuildList = () => (
    // Kolom penuh dengan daftar item yang scroll sendiri: ringkasan harga dan
    // tombol aksi (termasuk Print / Save PDF) tetap terlihat tanpa perlu
    // menggulir sampai dasar panel, berapapun banyaknya komponen dipilih.
    <div className="flex flex-col max-h-[70vh] md:max-h-[calc(100vh-11rem)] min-h-0">
      <h2 className="font-bold text-lg mb-4 hidden md:block shrink-0">My Build</h2>
      <div className="flex items-center justify-between mb-6 md:hidden shrink-0">
        <h2 className="font-bold text-lg">My Build</h2>
      </div>

      <div className="space-y-3 mb-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1">
        {steps.map(step => {
          const stepSels = selections[step.id]
          if (!Array.isArray(stepSels) || stepSels.length === 0) return null
          return stepSels.map((sel, idx) => (
            <div
              key={`${step.id}-${idx}`}
              className="group relative flex gap-2.5 rounded-lg border border-border/50 bg-muted/40 dark:bg-muted/20 p-2 transition-colors hover:border-border"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-background flex items-center justify-center">
                {sel.product.image ? (
                  <Image src={sel.product.image} alt={sel.product.name} width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                  <div className="text-[8px] font-semibold text-muted-foreground">N/A</div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground leading-none">
                  {step.name}
                </div>
                <div className="mt-1 text-xs font-semibold leading-snug line-clamp-2">
                  {sel.product.name}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xs font-black text-sale-red">
                    {formatRupiah(sel.product.price * sel.quantity)}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    &times;{sel.quantity}
                  </span>
                </div>
              </div>

              {/* Aksi tampil saat hover di desktop; di mobile selalu terlihat
                  karena tidak ada hover. */}
              <div className="flex shrink-0 flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setActiveStep(step.id)
                    setIsMobileMyBuildOpen(false)
                  }}
                  aria-label={`Ubah pilihan ${step.name}`}
                  className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-background hover:text-blue-600 active:scale-95 transition-all"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => removeProduct(step.id, sel.product.id)}
                  aria-label={`Hapus ${sel.product.name}`}
                  className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-background hover:text-sale-red active:scale-95 transition-all"
                >
                  <X className="h-3 w-3" />
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

      {/* Ringkasan & aksi selalu menempel di dasar panel, di luar area scroll. */}
      <div className="shrink-0 pt-3 border-t border-border/50">
        <div className="rounded-lg bg-muted/50 dark:bg-muted/20 p-3 mb-3 space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-bold">Total</span>
            <span className="text-base font-black text-sale-red tabular-nums">
              {formatRupiah(getTotalPrice())}
            </span>
          </div>
          <div className="flex justify-between items-baseline text-[11px] pt-0.5">
            <span className="text-muted-foreground">Komponen dipilih</span>
            <span className="font-semibold">{selectedStepsCount}/{totalSteps}</span>
          </div>
        </div>

        {/* Dua aksi utama sebaris supaya panel tidak memanjang ke bawah. */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => {
              if (activeStepIndex < totalSteps - 1) {
                setActiveStep(steps[activeStepIndex + 1].id)
                setIsMobileMyBuildOpen(false)
              }
            }}
            className="w-full cursor-pointer bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold h-10 rounded-lg text-sm transition-colors"
          >
            Continue
          </Button>

          <Button
            onClick={handleCheckoutWA}
            disabled={sendingWA}
            className="w-full cursor-pointer bg-[#25D366] hover:bg-[#1EBE5A] active:bg-[#17A74C] text-white font-bold h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm transition-colors"
          >
            {sendingWA ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
            ) : (
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">
              {sendingWA ? "Menyiapkan…" : "Konsultasi"}
            </span>
          </Button>
        </div>

        <button
          onClick={handlePrint}
          className="mt-2 w-full cursor-pointer flex items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/75 h-10 text-sm font-semibold transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Print / Save PDF
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto w-full pb-4 md:pb-0">
      
      {/* MOBILE DRAWER TOGGLES (Hidden on Desktop) */}
      <div className="fixed bottom-24 right-4 z-[60] md:hidden print:hidden flex flex-col gap-4">
        {/* Save/My Build Button */}
        <Button 
          onClick={() => {
            setIsMobileMyBuildOpen(!isMobileMyBuildOpen)
            if (isMobileStepsOpen) setIsMobileStepsOpen(false)
          }}
          className="cursor-pointer rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] dark:shadow-[0_0_15px_rgba(255,255,255,0.2)] bg-black hover:bg-black/80 active:scale-95 h-12 w-12 p-0 flex items-center justify-center text-white transition-all"
        >
          {isMobileMyBuildOpen ? <XCircle className="h-6 w-6" /> : <SaveIcon size={22} />}
        </Button>

        {/* Steps/Stack Button */}
        <Button 
          onClick={() => {
            setIsMobileStepsOpen(!isMobileStepsOpen)
            if (isMobileMyBuildOpen) setIsMobileMyBuildOpen(false)
          }}
          className="cursor-pointer rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] dark:shadow-[0_0_15px_rgba(255,255,255,0.2)] bg-black hover:bg-black/80 active:scale-95 h-12 w-12 p-0 flex items-center justify-center text-white transition-all"
        >
          {isMobileStepsOpen ? <XCircle className="h-6 w-6" /> : <Stack3Icon size={22} />}
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
        {isMobileStepsOpen && (
          <motion.div 
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            // Sama seperti drawer My Build: panel di dalamnya sudah punya area
            // scroll sendiri, jadi drawer ini tidak ikut men-scroll.
            className="fixed inset-x-0 bottom-0 z-[55] bg-card rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-border/50 p-5 max-h-[85vh] overflow-hidden md:hidden print:hidden"
          >
            {renderStepsList()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE SIDEBAR: My Build */}
      <AnimatePresence>
        {isMobileMyBuildOpen && (
          <motion.div 
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            // Panel My Build mengatur scroll-nya sendiri di dalam (daftar item
            // scroll, ringkasan & tombol tetap terlihat), jadi drawer ini tidak
            // ikut men-scroll supaya tidak ada dua scrollbar bertumpuk.
            className="fixed inset-x-0 bottom-0 z-[55] bg-card rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-border/50 p-5 max-h-[85vh] overflow-hidden md:hidden print:hidden"
          >
            {renderMyBuildList()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY FOR MOBILE DRAWERS */}
      <AnimatePresence>
        {(isMobileStepsOpen || isMobileMyBuildOpen) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[50] md:hidden"
            onClick={() => {
              setIsMobileStepsOpen(false)
              setIsMobileMyBuildOpen(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* MAIN CONTENT: Products */}
      <div className="flex-1 min-w-0 print:w-full">
        {/* Judul versi desktop. Di mobile judulnya pindah ke dalam bar
            mengambang di bawah, supaya tetap terlihat saat menggulir. */}
        <div className="mb-6 hidden md:block print:hidden">
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
              className="cursor-pointer px-4 h-10 bg-black text-white rounded-xl text-xs font-bold dark:bg-white dark:text-black hover:opacity-80 active:scale-95 transition-all whitespace-nowrap"
            >
              Sort by Alphabet {sortMode === "name_asc" ? "(A-Z)" : sortMode === "name_desc" ? "(Z-A)" : ""}
            </button>
            <button 
              onClick={() => {
                if (sortMode === "price_asc") setSortMode("price_desc")
                else if (sortMode === "price_desc") setSortMode("default")
                else setSortMode("price_asc")
              }}
              className="cursor-pointer px-4 h-10 bg-black text-white rounded-xl text-xs font-bold dark:bg-white dark:text-black hover:opacity-80 active:scale-95 transition-all whitespace-nowrap"
            >
              Sort by Price {sortMode === "price_asc" ? "(Low)" : sortMode === "price_desc" ? "(High)" : ""}
            </button>
          </div>
        )}

        {/* MOBILE FLOATING NAVBAR (Pill) FOR SEARCH & SORT */}
        {activeStep && (
          <div className="md:hidden fixed top-0 left-0 right-0 z-[45] p-3 pointer-events-none">
            <div className="bg-background/80 backdrop-blur-xl border shadow-lg rounded-2xl p-3 pointer-events-auto flex flex-col gap-2.5">
              {/* Nama step ikut di dalam bar mengambang. Kalau ditaruh di alur
                  normal halaman (seperti <h1> versi desktop), bar ini menutupinya
                  begitu halaman digulir — padahal justru saat menggulir daftar
                  panjang pengguna perlu tahu sedang memilih komponen apa. */}
              <div className="flex items-baseline justify-between gap-2">
                <h1 className="text-base font-extrabold tracking-tight truncate">
                  {activeStep.name}
                </h1>
                <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                  {activeStepIndex + 1}/{totalSteps}
                </span>
              </div>

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
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="cursor-pointer flex-1 h-8 bg-muted text-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 active:scale-95 transition-all whitespace-nowrap"
                >
                  A-Z {sortMode === "name_asc" ? "↓" : sortMode === "name_desc" ? "↑" : ""}
                </button>
                <button 
                  onClick={() => {
                    if (sortMode === "price_asc") setSortMode("price_desc")
                    else setSortMode("price_asc")
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="cursor-pointer flex-1 h-8 bg-muted text-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 active:scale-95 transition-all whitespace-nowrap"
                >
                  Price {sortMode === "price_asc" ? "↓" : sortMode === "price_desc" ? "↑" : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Jarak atas di mobile menyesuaikan tinggi bar mengambang (judul +
            kolom cari + tombol sort) dikurangi `py-8` milik pembungkus halaman,
            supaya kartu pertama tidak tertutup tapi juga tidak menyisakan
            celah kosong berlebih. */}
        <div className="md:mt-0 mt-[112px]">
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
                          description: `${activeStep?.name} berhasil dipilih`,
                          timeout: 2000,
                          data: { variant: "success" },
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
                    className="cursor-pointer rounded-xl px-8 h-12 font-bold hover:bg-accent active:scale-95 transition-all"
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
        
      </div>

      {/* RIGHT SIDEBAR: Summary */}
      <div className="hidden md:block w-full lg:w-72 shrink-0 print:hidden">
        <div className="sticky top-24 space-y-6">
          <div className="bg-card rounded-2xl shadow-sm border border-border/50 p-5">
            {renderMyBuildList()}
          </div>
        </div>
      </div>

    </div>
  )
}
