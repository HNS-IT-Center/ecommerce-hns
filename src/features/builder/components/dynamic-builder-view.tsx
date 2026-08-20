"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useNewBuilderStore, BuilderProduct, type BuilderSelection } from "@/store/new-builder"
import { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import { formatRupiah } from "@/lib/utils"
import { fetchBuilderProducts } from "../actions"
import { saveBuildAction } from "../actions-save"
import { useBuilderCatalogPricing } from "../hooks/use-builder-catalog-pricing"
import {
  PriceChangedBadge,
  UnavailableNotice,
  UnverifiedPriceNotice,
} from "@/components/shared/price-change-notice"
import { ProductCardBuilder } from "./product-card-builder"
import { SaveBuildDialog } from "./save-build-dialog"
import { StartNewBuildDialog } from "./start-new-build-dialog"
import { Check, Edit2, MessageCircle, Printer, Search, X, Loader2, RotateCcw, XCircle, History } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToastManager } from "@/components/ui/toast"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import Stack3Icon from "@/components/icons/stack-icon"
import SaveIcon from "@/components/icons/save-icon"

type DynamicBuilderViewProps = {
  stepsConfig: PcBuilderStepConfig[]
  /** Dari sesi customer di server — menentukan tombol Simpan aktif atau mengarah ke /login. */
  isLoggedIn: boolean
  /**
   * Paket PC Prebuild yang diminta lewat `?preset=`, sudah diselesaikan di
   * server lengkap dengan harga katalognya. `null` kalau tidak ada preset,
   * presetnya tidak ditemukan, atau sakelar fiturnya sedang mati.
   */
  presetLoad?: { name: string; selections: Record<string, BuilderSelection[]> } | null
}

/**
 * Nomor WhatsApp tidak lagi dioper dari env: tujuan dan harganya sama-sama
 * dibaca di server lewat `prepareBuildWhatsApp`, dari tabel stores.
 */
export function DynamicBuilderView({
  stepsConfig,
  isLoggedIn,
  presetLoad = null,
}: DynamicBuilderViewProps) {
  const { 
    steps, setSteps, selections, activeStepId, setActiveStep, 
    selectProduct, removeProduct, updateQuantity, getTotalPrice, clearSelections,
    hydrateSelections
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
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  // `true` kalau SaveBuildDialog dibuka lewat "Simpan Dulu" di
  // StartNewBuildDialog — menentukan apakah rakitan dikosongkan otomatis
  // setelah simpan sukses. Direset begitu SaveBuildDialog ditutup.
  const [saveDialogIsForNewBuild, setSaveDialogIsForNewBuild] = useState(false)
  const [isStartNewDialogOpen, setIsStartNewDialogOpen] = useState(false)
  // `null` = belum dievaluasi (sebelum hydration selesai). Dievaluasi TEPAT
  // SEKALI saat `mounted` pertama kali jadi true — lihat efek di bawah.
  // Bukan `useMemo` dari `selections`: kalau begitu, banner ini akan
  // muncul lagi setiap kali `hydrateSelections` dipanggil ("Lanjutkan di
  // Builder" dari rakitan tersimpan) padahal itu bukan kasus "rakitan lama
  // yang belum disentuh" — itu rakitan yang justru sengaja sedang dimuat.
  const [showPreviousBuildBanner, setShowPreviousBuildBanner] = useState(false)

  // Tawaran memuat paket PC Prebuild, hanya muncul kalau sudah ada rakitan
  // berjalan. Lihat efeknya di bawah.
  const [presetPending, setPresetPending] = useState(false)
  const presetSudahDitangani = useRef(false)
  const toastManager = useToastManager()

  /**
   * Harga dibaca dari katalog begitu halaman dibuka — bukan menunggu tombol.
   *
   * Rakitan mengendap di localStorage jauh lebih lama daripada keranjang: orang
   * menyusun PC selama berhari-hari sebelum memutuskan. Angka yang tampil di
   * panel karena itu harus benar sejak pertama dilihat, bukan hanya saat
   * dikirim ke CS. Alasan sama dengan `/cart` — lihat CartView.
   *
   * Satu kueri per kunjungan; mengganti komponen TIDAK memicu kueri baru.
   */
  const {
    pricing,
    loading: pricingLoading,
    error: pricingError,
    refresh: refreshPricing,
  } = useBuilderCatalogPricing({ auto: true })

  /**
   * Selagi katalog belum terbaca, yang tampil adalah harga dari localStorage —
   * persis angka yang berpotensi basi. Karena itu setiap tempat yang memakai
   * fallback ini WAJIB berdampingan dengan `UnverifiedPriceNotice`.
   */
  const unitPriceOf = (product: { id: number; price: number }) =>
    pricing?.unitPriceByProductId[Number(product.id)] ?? product.price

  const isUnavailable = (product: { id: number }) =>
    pricing?.unavailableProductIds.includes(Number(product.id)) ?? false

  const changeOf = (product: { id: number }) =>
    pricing?.changes.find((c) => c.productId === Number(product.id))

  /**
   * `true` selama angka di panel belum dipastikan ke katalog.
   *
   * Sengaja mencakup jendela SEBELUM pembacaan pertama dimulai, bukan hanya
   * saat `pricingLoading` menyala: antara render pertama dan selesainya
   * hydration localStorage, `pricing` masih null sementara panel sudah
   * menampilkan angka dari store. Tanpa ini ada jeda di mana harga basi tampil
   * tanpa penanda — keadaan yang justru sedang diperbaiki di sini.
   *
   * Rakitan kosong tidak dihitung: tidak ada angka untuk diragukan.
   */
  const adaPilihan = Object.values(selections).some(
    (v) => Array.isArray(v) && v.length > 0
  )
  const priceUnverified = adaPilihan && !pricing

  useEffect(() => {
    setMounted(true)
  }, [])

  /**
   * Memuat paket PC Prebuild dari `?preset=`.
   *
   * Aturannya: MUAT KALAU KOSONG, TANYA KALAU SUDAH ADA ISINYA. Menimpa
   * diam-diam berarti membuang rakitan yang sedang disusun seseorang tanpa
   * peringatan; selalu bertanya berarti menambah dialog pada jalur yang
   * seharusnya satu klik.
   *
   * WAJIB menunggu `mounted`. Isi store baru terbaca setelah hydration Zustand
   * persist selesai — sebelum itu store SELALU terlihat kosong, dan rakitan
   * pelanggan akan tertimpa tanpa sempat ditanya.
   */
  useEffect(() => {
    if (!mounted || !presetLoad || presetSudahDitangani.current) return
    presetSudahDitangani.current = true

    const adaRakitanBerjalan = Object.values(
      useNewBuilderStore.getState().selections
    ).some((v) => Array.isArray(v) && v.length > 0)

    if (adaRakitanBerjalan) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPresetPending(true)
      return
    }

    hydrateSelections(presetLoad.selections)
  }, [mounted, presetLoad, hydrateSelections])

  // Sengaja bergantung pada `mounted` saja, BUKAN `selections` — supaya cek
  // "ada rakitan lama" hanya jalan sekali di titik hydration selesai, tidak
  // setiap kali `selections` berubah karena pilihan baru di sesi ini.
  useEffect(() => {
    if (mounted && Object.keys(useNewBuilderStore.getState().selections).length > 0) {
      // Deteksi "ada rakitan lama" HARUS menunggu hydration Zustand persist
      // selesai (ditandai `mounted`), yang hanya diketahui lewat efek; tidak
      // ada nilai untuk dibaca saat render pertama karena localStorage belum
      // terbaca saat itu.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPreviousBuildBanner(true)
    }
  }, [mounted])

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

    setSendingWA(true)
    try {
      // Katalog dibaca ULANG di sini, tidak memakai hasil saat halaman dibuka:
      // komponen mungkin sudah diganti sejak itu, dan yang dikirim ke CS harus
      // mencerminkan rakitan pada detik tombol ditekan. Pola sama dengan
      // `handleCheckoutWA` di CartView.
      const hasil = await refreshPricing()
      if (!hasil) {
        toastManager.add({
          title: "Gagal menyiapkan pesan",
          description: pricingError ?? "Coba lagi sebentar lagi.",
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
    } finally {
      setSendingWA(false)
    }
  }

  /**
   * Sama pola dengan `handlePrint`/`handleCheckoutWA`: klien hanya mengirim id,
   * kuantitas, dan label — harga tidak pernah dikirim atau disimpan. Lihat
   * `actions-save.ts` dan CLAUDE.md §2.7.
   */
  const buildLineItems = () =>
    steps.flatMap((step) => {
      const stepSels = selections[step.id]
      if (!Array.isArray(stepSels)) return []
      return stepSels.map((sel) => ({
        productId: Number(sel.product.id),
        quantity: sel.quantity,
        stepId: step.id,
        stepName: step.name,
      }))
    })

  const handleOpenSaveDialog = () => {
    if (buildLineItems().length === 0) {
      toastManager.add({
        title: "Build Kosong",
        description: "Belum ada komponen yang dipilih.",
      })
      return
    }

    if (!isLoggedIn) {
      window.location.href = "/login?next=/build-pc"
      return
    }

    setSaveDialogIsForNewBuild(false)
    setIsSaveDialogOpen(true)
  }

  const handleConfirmSaveBuild = async (name: string) => {
    return saveBuildAction(name, buildLineItems())
  }

  /**
   * Rakitan dikosongkan HANYA di sini dan di tombol Reset yang sudah ada —
   * tidak pernah otomatis. Dipanggil dari `StartNewBuildDialog` setelah
   * pelanggan memilih "Mulai Tanpa Simpan"/"Mulai Rakitan Baru" secara
   * eksplisit. Banner-nya sendiri ikut ditutup: begitu rakitan dikosongkan,
   * tidak ada lagi "rakitan sebelumnya" untuk diberitahukan.
   */
  const handleDiscardAndStartNew = () => {
    clearSelections()
    setShowPreviousBuildBanner(false)
  }

  /**
   * "Simpan Dulu" dari dalam StartNewBuildDialog membuka SaveBuildDialog yang
   * sama seperti tombol Simpan biasa — TIDAK ada form simpan kedua. Begitu
   * simpan sukses, rakitan lama otomatis dikosongkan (lewat `onSaved` di
   * bawah) karena niat awalnya memang "mulai baru", bukan sekadar menyimpan.
   */
  const handleSaveFirst = () => {
    setSaveDialogIsForNewBuild(true)
    setIsSaveDialogOpen(true)
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
                    {isUnavailable(sel.product)
                      ? "—"
                      : formatRupiah(unitPriceOf(sel.product) * sel.quantity)}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    &times;{sel.quantity}
                  </span>
                </div>

                {/* Perubahan disebut di baris komponennya sendiri, bukan hanya
                    terlihat sebagai total yang bergeser. Komponen yang sudah
                    tidak dijual ditandai — tombol hapusnya yang sudah ada di
                    sebelah kanan baris ini, tidak perlu tombol kedua. */}
                {(() => {
                  if (isUnavailable(sel.product)) {
                    return <UnavailableNotice name={sel.product.name} density="compact" />
                  }
                  if (priceUnverified) {
                    return (
                      <UnverifiedPriceNotice
                        state={pricingError ? "error" : "loading"}
                        density="compact"
                      />
                    )
                  }
                  const perubahan = changeOf(sel.product)
                  if (perubahan) {
                    return (
                      <PriceChangedBadge
                        oldUnitPrice={perubahan.oldUnitPrice}
                        newUnitPrice={perubahan.newUnitPrice}
                        density="compact"
                      />
                    )
                  }
                  return null
                })()}
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
              {/* `pricing.total` sudah mengecualikan komponen yang tidak
                  tersedia. Fallback ke `getTotalPrice()` hanya berlaku selagi
                  katalog belum terbaca — dan saat itu penandanya tampil di
                  bawah. */}
              {formatRupiah(pricing?.total ?? getTotalPrice())}
            </span>
          </div>
          <div className="flex justify-between items-baseline text-[11px] pt-0.5">
            <span className="text-muted-foreground">Komponen dipilih</span>
            <span className="font-semibold">{selectedStepsCount}/{totalSteps}</span>
          </div>

          {/* Kegagalan verifikasi TIDAK memblokir tombol Konsultasi di bawah:
              harga yang dikirim ke CS dibaca ulang di server, jadi pemesanan
              tetap aman walau panel gagal memastikan angkanya di sini. */}
          {priceUnverified && (
            <p
              className={`flex items-center gap-1.5 pt-0.5 text-[10px] leading-tight ${
                pricingError ? "text-sale-red" : "text-muted-foreground"
              }`}
            >
              {!pricingError && (
                <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden="true" />
              )}
              {pricingError
                ? "Harga belum bisa diverifikasi. Angka di atas berasal dari rakitan tersimpan dan mungkin sudah berubah — CS akan mengonfirmasi harga terkini."
                : "Memeriksa harga terbaru…"}
            </p>
          )}

          {/* Menyebut sebabnya, bukan sekadar menampilkan angka lain. */}
          {!pricingLoading && pricing && pricing.changes.length > 0 && (
            <p className="pt-0.5 text-[10px] leading-tight text-muted-foreground">
              {pricing.changes.length === 1
                ? "Satu komponen"
                : `${pricing.changes.length} komponen`}{" "}
              berubah harganya sejak terakhir Anda lihat.
            </p>
          )}

          {!pricingLoading && pricing && pricing.unavailableProductIds.length > 0 && (
            <p className="pt-0.5 text-[10px] leading-tight text-sale-red">
              {pricing.unavailableProductIds.length} komponen sudah tidak
              tersedia dan tidak ikut dihitung.
            </p>
          )}
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

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={handlePrint}
            className="cursor-pointer flex items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/75 h-10 text-sm font-semibold transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            onClick={handleOpenSaveDialog}
            className="cursor-pointer flex items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-background text-foreground hover:bg-muted h-10 text-sm font-semibold transition-colors"
          >
            <SaveIcon size={14} />
            Simpan
          </button>
        </div>
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
        {/* Banner "rakitan lama" — SENGAJA di dalam kolom konten, bukan
            selebar 3 kolom (root flex tidak wrap; elemen basis-full di sana
            ikut berbagi baris horizontal dengan sidebar, bukan membuat baris
            sendiri — lihat docs/06-coding-standards.md §9.2). Ditempatkan di
            paling atas kolom ini, sebelum judul, supaya di mobile (di mana
            root sudah flex-col dan kolom ini render setelah "Build
            Progress") banner tetap jadi hal pertama dari isi builder yang
            terlihat — bukan terselip di antara grid produk.

            `mt-[112px] md:mt-0`: berbeda dari `<h1>` desktop di bawah (yang
            `hidden md:block` karena judulnya pindah ke bar mengambang di
            mobile), banner ini SELALU dirender, termasuk di mobile. Bar
            mengambang itu `fixed top-0` dan menimpa apa pun yang duduk di
            posisi dokumen normal di bawahnya — tanpa kompensasi ini banner
            ada di DOM (terverifikasi lewat getBoundingClientRect) tapi
            sepenuhnya tertutup, persis seperti alasan grid produk di bawah
            memakai jarak yang sama.

            HANYA hilang lewat tombol x manual: pelanggan yang iseng mengubah
            satu komponen sebelum sadar "ini bukan yang mau saya lanjutkan"
            harus tetap melihatnya, bukan kehilangan jejaknya setelah
            perubahan pertama. */}
        {presetPending && presetLoad && (
          <div className="mb-6 mt-[112px] md:mt-0 flex flex-col items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30 print:hidden sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Muat paket &ldquo;{presetLoad.name}&rdquo;?</span>{" "}
              Rakitan yang sedang kamu susun akan diganti.
            </div>
            <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
              <button
                onClick={() => {
                  hydrateSelections(presetLoad.selections)
                  setPresetPending(false)
                  setShowPreviousBuildBanner(false)
                }}
                className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
              >
                Muat paket
              </button>
              <button
                onClick={() => setPresetPending(false)}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                Pertahankan rakitan saya
              </button>
            </div>
          </div>
        )}

        {showPreviousBuildBanner && (
          <div className="mb-6 mt-[112px] md:mt-0 flex flex-col items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950/30 print:hidden sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <History className="h-4 w-4 shrink-0" />
              <span className="font-medium">Melanjutkan rakitan sebelumnya</span>
            </div>
            <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
              <button
                onClick={() => setIsStartNewDialogOpen(true)}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                Mulai Rakitan Baru
              </button>
              <button
                onClick={() => setShowPreviousBuildBanner(false)}
                aria-label="Tutup pemberitahuan"
                className="cursor-pointer rounded-lg p-1.5 text-blue-800 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

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

      <SaveBuildDialog
        open={isSaveDialogOpen}
        onOpenChange={(next) => {
          setIsSaveDialogOpen(next)
          if (!next) setSaveDialogIsForNewBuild(false)
        }}
        onConfirm={handleConfirmSaveBuild}
        onSaved={saveDialogIsForNewBuild ? handleDiscardAndStartNew : undefined}
      />

      <StartNewBuildDialog
        open={isStartNewDialogOpen}
        onOpenChange={setIsStartNewDialogOpen}
        isLoggedIn={isLoggedIn}
        onSaveFirst={handleSaveFirst}
        onDiscard={handleDiscardAndStartNew}
      />
    </div>
  )
}
