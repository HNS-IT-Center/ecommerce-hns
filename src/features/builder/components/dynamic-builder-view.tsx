"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import {
  sumBuilderSelections,
  useNewBuilderStore,
  BuilderProduct,
  type BuilderSelection,
  type BuilderVariation,
} from "@/store/new-builder"
import { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import { buildAttributeRequirementGroups } from "@/lib/pc-builder/compatibility"
import { formatRupiah } from "@/lib/utils"
import { fetchBuilderProducts } from "../actions"
import { saveBuildAction } from "../actions-save"
import { useBuilderCatalogPricing } from "../hooks/use-builder-catalog-pricing"
import {
  PriceChangedBadge,
  UnavailableNotice,
  UnverifiedPriceNotice,
} from "@/components/shared/price-change-notice"
import { ProductCardBuilder, type SelectedVariationLine } from "./product-card-builder"
import { VariationPickerDialog } from "./variation-picker-dialog"
import { BuilderQuickViewDialog } from "./builder-quick-view-dialog"
import { cheapestAvailableVariation } from "@/lib/utils/variation"
import { SaveBuildDialog } from "./save-build-dialog"
import { StartNewBuildDialog } from "./start-new-build-dialog"
import { LoginPromptDialog } from "@/features/auth/components/login-prompt-dialog"
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Edit2, MessageCircle, Printer, Search, X, Loader2, RotateCcw, History } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToastManager } from "@/components/ui/toast"
import { prepareInternalOpen } from "@/features/pwa/lib/open-internal"
import {
  issueQuotationAction,
  reviseQuotationAction,
} from "@/features/builder/actions-quotation"
import {
  IssueQuotationDialog,
  type QuotationFormValues,
  type SalesOption,
} from "./issue-quotation-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { motion, AnimatePresence } from "framer-motion"
import Stack3Icon from "@/components/icons/stack-icon"
import SaveIcon from "@/components/icons/save-icon"
import { ProductImage } from "@/components/ui/product-image"

/**
 * Alamat halaman cetak, lengkap dengan token penawarannya.
 *
 * `t=` bukan hiasan: sejak 23 September 2026 halaman cetak menolak `?kode=`
 * telanjang dari siapa pun yang tidak punya sesi staff. Yang menekan Print di
 * sini sebagian besar justru PENGUNJUNG anonim, jadi tanpa token mereka akan
 * ditolak membuka dokumen yang baru saja mereka terbitkan sendiri.
 *
 * Token boleh kosong hanya untuk quotation lama yang belum di-backfill; dalam
 * hal itu `?t=` tidak ikut ditulis dan yang membuka harus staff.
 */
function printHref(code: string, token: string): string {
  const alamat = `/build-pc/print?kode=${encodeURIComponent(code)}`
  return token ? `${alamat}&t=${encodeURIComponent(token)}` : alamat
}

/**
 * Quotation yang sedang direvisi, sudah diselesaikan di server.
 *
 * `hargaSnapshot` adalah harga REVISI SEBELUMNYA per produk — angka yang sudah
 * tercetak di kertas pelanggan. Ia dipakai sebagai harga tampil selama tombol
 * "Gunakan harga terbaru" mati. Ini bukan harga karangan klien: nilainya berasal
 * dari katalog saat revisi itu diterbitkan, disimpan server, dan dikirim apa
 * adanya — pola yang sama dengan `SavedPcBuild.price`. Klien tidak pernah
 * menghitung, cuma memilih peta harga mana yang dipakai, dan pilihan itu
 * dikirim sebagai BOOLEAN ke server yang menghitung ulang sendiri.
 *
 * Komponen yang ditambahkan SAAT revisi tidak ada di peta ini, jadi ia otomatis
 * jatuh ke harga katalog — persis aturannya.
 */
export type RevisionLoad = {
  code: string
  /** Revisi yang berlaku sekarang; yang akan ditulis adalah `revisiBerlaku + 1`. */
  revisiBerlaku: number
  customerName: string
  customerPhone: string
  internalNote: string
  selections: Record<string, BuilderSelection[]>
  hargaSnapshot: Record<number, number>
  perubahanHarga: { name: string; hargaLama: number; hargaBaru: number }[]
  /** Komponen yang sudah lenyap dari katalog dan tidak bisa dimuat ulang. */
  komponenHilang: string[]
}

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
  /**
   * Cara penerbitan quotation, sudah dihitung di server dari izin.
   *
   * `"anon"`    — pengunjung & pelanggan biasa: Print langsung menerbitkan
   *               dokumen anonim, tanpa dialog, persis seperti sebelumnya.
   * `"sendiri"` — dialog identitas pelanggan; pemiliknya dirinya sendiri.
   * `"oper"`    — dialog yang sama + wajib memilih Sales tujuan atau
   *               "Tidak oper". Dibuka izin `quotation-oper`.
   *
   * Yang dibedakan di sini BUKAN "sales atau CS", melainkan "boleh mengoper
   * atau tidak" — dua orang dengan jabatan sama bisa berbeda di sini, dan
   * seorang sales yang merangkap CS memakai mode `oper` sambil tetap bisa
   * memilih "Tidak oper" untuk menyimpannya atas namanya sendiri.
   *
   * Ini menentukan APA YANG TERLIHAT saja. Siapa pemilik quotation diputuskan
   * ulang di server (`actions-quotation.ts`) dari izin sesi, karena server
   * action adalah endpoint HTTP tersendiri yang bisa dipanggil tanpa memuat
   * halaman ini.
   */
  quotationMode?: "anon" | "sendiri" | "oper"
  /** Kandidat operan untuk mode `oper`. Kosong untuk mode lain. */
  salesOptions?: SalesOption[]
  /** Terisi hanya saat `?quotation=` menunjuk quotation yang boleh direvisi. */
  revisionLoad?: RevisionLoad | null
}

/**
 * Nomor WhatsApp tidak lagi dioper dari env: tujuan dan harganya sama-sama
 * dibaca di server lewat `prepareBuildWhatsApp`, dari tabel stores.
 */
export function DynamicBuilderView({
  stepsConfig,
  isLoggedIn,
  presetLoad = null,
  quotationMode = "anon",
  salesOptions = [],
  revisionLoad = null,
}: DynamicBuilderViewProps) {
  const { 
    steps, setSteps, selections, activeStepId, setActiveStep, 
    selectProduct, removeProduct, updateQuantity, clearSelections,
    hydrateSelections
  } = useNewBuilderStore()

  const [mounted, setMounted] = useState(false)
  const [sendingWA, setSendingWA] = useState(false)
  const [issuingQuote, setIssuingQuote] = useState(false)
  const [isQuotationDialogOpen, setIsQuotationDialogOpen] = useState(false)
  /**
   * Mati secara bawaan, dan itu keputusan yang disengaja: harga yang sudah
   * dipegang pelanggan dipertahankan kecuali sales memilih sebaliknya.
   */
  const [pakaiHargaTerbaru, setPakaiHargaTerbaru] = useState(false)
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
  // Konfirmasi tombol Reset. Menggantikan `window.confirm` — lihat
  // `handleRequestReset` di bawah.
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  // Ajakan masuk untuk pengunjung tanpa akun yang menekan Simpan. Menggantikan
  // lompatan langsung ke /login — lihat `handleOpenSaveDialog`.
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false)
  /**
   * Pemilih varian: APA yang ditampilkan, dan APAKAH sedang terbuka — sengaja
   * dua state, bukan satu `BuilderProduct | null`.
   *
   * Alasannya bukan selera. `VariationPickerDialog` WAJIB selalu ter-mount dan
   * dikendalikan lewat prop `open`; membungkusnya dalam `{produk && …}`
   * membuatnya lahir dalam keadaan terbuka, dan itu bertabrakan dengan
   * `useBackToClose` sehingga dialognya tertutup pada detik yang sama ia
   * dibuka — tanpa error, tanpa apa pun di layar. Penjelasan lengkap ada di
   * berkas dialognya.
   *
   * Produknya sengaja TIDAK dikosongkan saat ditutup: isinya harus tetap ada
   * selama animasi tutup berjalan, kalau tidak dialognya berkedip kosong
   * sepersekian detik sebelum hilang.
   *
   * Yang disimpan adalah PRODUKNYA, bukan sekadar id: kartu induk bisa berasal
   * dari grid maupun dari rakitan yang dimuat dari localStorage, dan dialognya
   * harus tetap bisa ditampilkan walau produknya tidak ada di halaman grid yang
   * sedang terbuka.
   */
  const [variationPicker, setVariationPicker] = useState<BuilderProduct | null>(null)
  const [isVariationPickerOpen, setIsVariationPickerOpen] = useState(false)
  /**
   * Quick Preview: dua state dengan alasan yang SAMA PERSIS seperti pemilih
   * varian di atas — dialognya harus selalu ter-mount dan produknya tetap ada
   * selama animasi tutup berjalan. Lihat catatannya di
   * `builder-quick-view-dialog.tsx`.
   */
  const [quickViewProduct, setQuickViewProduct] = useState<BuilderProduct | null>(null)
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false)
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
  const revisiSudahDimuat = useRef(false)
  const toastManager = useToastManager()

  /**
   * Id toast merah "<langkah> belum dipilih" dari `validateRequiredSteps`.
   *
   * Harus ditutup begitu pelanggan memilih komponen. `<Toast limit={1}>` di
   * root layout TIDAK membuang toast lama saat toast baru datang — base-ui
   * hanya menandainya `limited` dan menyembunyikannya. Akibatnya toast hijau
   * "Komponen Ditambahkan" (2 detik) menutupi toast merah sebentar, lalu begitu
   * hijau hilang, merah yang sudah basi muncul lagi dan memberi tahu pelanggan
   * bahwa langkah yang barusan ia isi masih kosong.
   */
  const missingStepToastIdRef = useRef<string | null>(null)

  const dismissMissingStepToast = () => {
    if (missingStepToastIdRef.current === null) return
    toastManager.close(missingStepToastIdRef.current)
    missingStepToastIdRef.current = null
  }

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
  /**
   * Urutannya penting di Mode Revisi.
   *
   * Harga revisi sebelumnya menang atas harga katalog selama tombol "Gunakan
   * harga terbaru" mati — kalau tidak, panel akan menampilkan angka katalog hari
   * ini sementara yang benar-benar tersimpan nanti adalah angka lama, dan sales
   * melihat total yang berbeda dari dokumen yang ia terbitkan.
   *
   * Komponen yang ditambahkan saat revisi tidak ada di peta itu, jadi ia jatuh
   * ke katalog dengan sendirinya — memang begitu aturannya.
   */
  const hargaRevisiAktif =
    revisionLoad && !pakaiHargaTerbaru ? revisionLoad.hargaSnapshot : null

  const unitPriceOf = (product: { id: number; price: number }) =>
    hargaRevisiAktif?.[Number(product.id)] ??
    pricing?.unitPriceByProductId[Number(product.id)] ??
    product.price

  const isUnavailable = (product: { id: number }) =>
    pricing?.unavailableProductIds.includes(Number(product.id)) ?? false

  const changeOf = (product: { id: number }) =>
    pricing?.changes.find((c) => c.productId === Number(product.id))

  /**
   * `true` kalau harga komponen INI belum dipastikan ke katalog.
   *
   * Dulu ini satu boolean untuk seluruh panel (`adaPilihan && !pricing`), dan
   * itu meleset di kasus yang paling sering terjadi: katalog dibaca sekali saat
   * halaman dibuka, lalu pelanggan menambah komponen lagi. `pricing` sudah
   * terisi, jadi panel menyatakan semuanya terverifikasi — padahal komponen
   * yang baru masuk sama sekali belum pernah dibaca harganya dan angkanya masih
   * dari localStorage.
   *
   * Diperiksa per komponen: id yang tidak ada di `unitPriceByProductId` DAN
   * tidak ada di `unavailableProductIds` berarti katalog belum pernah ditanya
   * soal dia. Komponen yang sudah terbukti hilang justru TERVERIFIKASI — ia
   * ditandai lewat `UnavailableNotice`, bukan lewat penanda ini.
   */
  const priceUnverifiedFor = (product: { id: number }) => {
    if (!pricing) return true
    const id = Number(product.id)
    return (
      pricing.unitPriceByProductId[id] === undefined &&
      !pricing.unavailableProductIds.includes(id)
    )
  }

  /**
   * Rakitan kosong tidak dihitung: tidak ada angka untuk diragukan.
   */
  const adaPilihan = Object.values(selections).some(
    (v) => Array.isArray(v) && v.length > 0
  )

  /** Ada MINIMAL SATU komponen yang angkanya belum dipastikan. */
  const priceUnverified =
    adaPilihan &&
    Object.values(selections).some(
      (v) => Array.isArray(v) && v.some((sel) => priceUnverifiedFor(sel.product))
    )

  /**
   * Total yang tampil di panel — dijumlahkan dari komponen yang sedang terlihat,
   * BUKAN diambil dari `pricing.total`.
   *
   * Baris ini dulu berbunyi `pricing?.total ?? getTotalPrice()`, dan di situlah
   * bug-nya: `pricing` dibaca TEPAT SEKALI per kunjungan (lihat flag
   * `sudahJalan` di useBuilderCatalogPricing). Begitu ia terisi oleh komponen
   * pertama, `pricing.total` tidak pernah dihitung ulang, dan karena ia sudah
   * bukan null, fallback `getTotalPrice()` yang reaktif itu tidak pernah
   * terpakai lagi. Menambah komponen kedua, ketiga, dan seterusnya tidak
   * menggeser totalnya sama sekali — sementara harga per barisnya ikut naik,
   * karena baris memakai `unitPriceOf`. Panel menampilkan total yang lebih
   * kecil dari penjumlahan isinya sendiri, tanpa penanda apa pun, pada rakitan
   * yang nilainya puluhan juta.
   *
   * `getTotalPrice()` itu sendiri sudah DIHAPUS dari store — ia menjumlahkan
   * harga localStorage, dan selama ia ada, ia akan terus terlihat seperti
   * jawaban yang wajar untuk pertanyaan "berapa totalnya?".
   *
   * Sekarang total dan baris memakai `unitPriceOf` yang sama persis, jadi
   * keduanya mustahil berbeda. Komponen yang sudah tidak terbit dikecualikan —
   * ia juga tidak ikut dikirim ke CS.
   *
   * Yang BELUM terverifikasi tetap ikut dijumlahkan memakai harga localStorage,
   * karena membuangnya justru menampilkan total yang lebih kecil dari isi
   * rakitan. Penandanya tampil tepat di bawah angka ini SELAMA keadaannya
   * `loading` atau `error` saja — keadaan `pending` sengaja tidak ditandai,
   * lihat alasannya di ringkasan panel. Yang menjaga angkanya bukan penanda
   * itu melainkan pembacaan ulang di server: total ke CS dibaca ulang saat
   * tombol Konsultasi ditekan, dan PDF quotation menyusun harganya sendiri di
   * `/build-pc/print` dari katalog.
   */
  /**
   * Keadaan penanda "belum diverifikasi", dipakai baris komponen maupun
   * ringkasan di bawah. `pending` adalah keadaan yang paling sering terjadi
   * sejak katalog hanya dibaca sekali: komponen yang ditambahkan sesudahnya
   * tidak sedang diperiksa oleh siapa pun.
   */
  const unverifiedState: "loading" | "error" | "pending" = pricingError
    ? "error"
    : pricingLoading
      ? "loading"
      : "pending"

  const displayedTotal = sumBuilderSelections(
    selections,
    (sel) => unitPriceOf(sel.product),
    (sel) => isUnavailable(sel.product)
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  /**
   * Memuat quotation yang sedang direvisi dari `?quotation=`.
   *
   * Berbeda dari `?preset=`, ini TIDAK bertanya lebih dulu. Sales yang menekan
   * "Revisi di Builder" sedang menyatakan niatnya dengan jelas, dan rakitan
   * yang kebetulan tertinggal di localStorage-nya bukan pekerjaan yang sedang
   * ia kerjakan — ia sudah menyimpannya sebagai quotation.
   *
   * Tetap WAJIB menunggu `mounted`: sebelum hydration Zustand persist selesai,
   * `hydrateSelections` akan tertimpa kembali oleh isi localStorage.
   */
  useEffect(() => {
    if (!mounted || !revisionLoad || revisiSudahDimuat.current) return
    revisiSudahDimuat.current = true
    hydrateSelections(revisionLoad.selections)
  }, [mounted, revisionLoad, hydrateSelections])

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

  /**
   * Syarat kompatibilitas untuk langkah yang sedang dibuka, disusun dari
   * komponen yang sudah dipilih di langkah-langkah yang ia andalkan.
   *
   * Dikelompokkan per atribut per komponen induk — BUKAN daftar valueId datar
   * yang semuanya wajib dimiliki. Casing ATX tercatat sebagai tiga nilai
   * "Motherboard Size" sekaligus, dan menuntut motherboard memiliki ketiganya
   * membuang justru yang cocok. Aturan lengkapnya (dan alasannya) ada di
   * `lib/pc-builder/compatibility.ts`, yang juga dipakai store saat memangkas
   * pilihan langkah lain — keduanya WAJIB sepakat.
   */
  const requiredAttributeValueGroups = useMemo(() => {
    if (!activeStep) return []

    const parents = (activeStep.dependSteps ?? []).flatMap(depStepId => {
      const stepSels = Array.isArray(selections[depStepId]) ? selections[depStepId] : []
      return stepSels.map(sel => sel.product)
    })

    return buildAttributeRequirementGroups(parents, activeStep.dependAttributes)
  }, [activeStep, selections])

  // Kunci efek pemuatan: bentuk datar dari kelompoknya, dengan `|` memisahkan
  // kelompok supaya dua susunan berbeda tidak menghasilkan kunci yang sama.
  const reqAttrIdsStr = requiredAttributeValueGroups.map(g => g.join(",")).join("|");

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
      requiredAttributeValueGroups,
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
      <div className="flex min-h-placeholder items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground/30" />
      </div>
    )
  }

  /**
   * Penjaga terakhir sebelum rakitan KELUAR dari halaman ini — ke PDF quotation
   * (`handlePrint`) atau ke CS (`handleCheckoutWA`).
   *
   * MEMBLOKIR, berbeda dengan `handleAdvanceStep` yang hanya mengingatkan saat
   * orang berpindah langkah. Bedanya disengaja: berpindah langkah masih bagian
   * dari proses merakit, sedangkan dua aksi di atas menghasilkan dokumen yang
   * dibawa pelanggan dan pesan yang sudah sampai ke CS. Rakitan tanpa komponen
   * wajib di situ berakhir jadi penawaran yang tidak bisa dipenuhi.
   *
   * Selain menolak, ia MENGANTAR: langkah wajib pertama yang kosong langsung
   * dibuka. Daftar nama di toast saja tidak cukup — sidebar bisa berisi belasan
   * langkah, dan menyuruh orang mencari sendiri langkah yang dimaksud adalah
   * pekerjaan yang tidak perlu ada.
   *
   * `closeMobileDrawers()` bukan pemanis. Di mobile tombol ini ditekan DARI
   * DALAM laci My Build yang duduk di `z-[55]`; tanpa menutupnya, langkah yang
   * baru dibuka tertutup laci dan toast-nya pun tidak terlihat, sehingga yang
   * terasa oleh pelanggan cuma "tombolnya tidak berfungsi".
   *
   * Tombol "Simpan" sengaja TIDAK memakai penjaga ini: menyimpan rakitan yang
   * belum selesai untuk dilanjutkan nanti justru itulah gunanya fitur tersebut.
   */
  const validateRequiredSteps = () => {
    const missingSteps = steps.filter(s => s.isRequired && (!Array.isArray(selections[s.id]) || selections[s.id].length === 0))
    if (missingSteps.length === 0) return true

    const [firstMissing, ...restMissing] = missingSteps

    // Menekan Print dua kali tidak boleh menumpuk dua toast merah yang sama.
    dismissMissingStepToast()
    missingStepToastIdRef.current = toastManager.add({
      title: `${firstMissing.name} belum dipilih`,
      description:
        restMissing.length > 0
          ? `Komponen wajib ini harus diisi dulu. Setelah itu masih ada: ${restMissing.map(s => s.name).join(", ")}.`
          : "Komponen ini wajib diisi sebelum rakitan bisa dicetak atau dikirim ke CS.",
      // Merah menandai satu hal saja di halaman ini: aksi yang baru ditekan
      // DIBATALKAN. Itu sebabnya "Build Kosong" dan "Gagal menyiapkan pesan"
      // ikut merah, sedangkan "Sebagian komponen tidak tersedia" tetap netral
      // — yang terakhir itu mengabarkan sesuatu sambil pesannya tetap terkirim.
      // Tanpa batas itu, merah cuma jadi warna untuk "kabar penting" dan
      // pelanggan berhenti bisa menebak apakah tombolnya jadi atau tidak.
      data: { variant: "danger" },
    })

    // Laci ditutup DULU, baru langkahnya dipindah — supaya langkah tujuan tidak
    // sempat terlukis di balik laci yang masih terbuka.
    closeMobileDrawers()
    setActiveStep(firstMissing.id)

    return false
  }

  /**
   * Menerbitkan quotation lewat server action, lalu membuka halaman cetaknya.
   *
   * Dulu tombol ini cuma membuka `/build-pc/print?items=…` dan halaman itulah
   * yang menulis ke database. Sejak kodenya berupa nomor urut, menulis saat GET
   * jadi tidak bisa dipertahankan: refresh tab PDF akan memakan nomor baru.
   * Sekarang nomor terbit SEKALI di sini, dan halaman cetak hanya membaca.
   *
   * Yang dikirim tetap hanya id & kuantitas — nama, harga, dan gambar dibaca
   * ulang dari katalog di server, jadi harga di PDF tidak bisa dipalsukan lewat
   * inspect element di halaman ini (CLAUDE.md §2.7).
   */
  /** Komponen terpilih sebagai id & kuantitas. Tidak pernah membawa harga. */
  const kumpulkanItems = () =>
    steps.flatMap((step) => {
      const stepSels = selections[step.id]
      if (!Array.isArray(stepSels)) return []
      return stepSels.map((sel) => ({
        stepId: step.id,
        productId: sel.product.id,
        quantity: sel.quantity,
      }))
    })

  const handlePrint = async () => {
    // Langkah wajib dijaga di SINI, bukan cuma di `handleCheckoutWA`. PDF
    // quotation ini dicetak dan dibawa pelanggan; kalau ia boleh terbit tanpa
    // komponen wajib, tanda `*` di daftar langkah tidak berarti apa-apa dan CS
    // menerima pertanyaan atas dokumen yang rakitannya tidak bisa dirakit.
    if (!validateRequiredSteps()) return
    if (issuingQuote) return

    if (kumpulkanItems().length === 0) {
      toastManager.add({
        title: "Build Kosong",
        description: "Belum ada komponen yang dipilih.",
        data: { variant: "danger" },
      })
      return
    }

    /**
     * Staff mengisi identitas pelanggan dulu; pengunjung langsung terbit.
     *
     * Dialognya TIDAK dibuka lewat `prepareInternalOpen` — tab cetak baru
     * disiapkan saat tombol Terbitkan di dalam dialog ditekan, karena gestur
     * klik yang dihitung browser adalah klik itu, bukan klik yang membuka
     * dialog beberapa detik sebelumnya.
     */
    if (quotationMode !== "anon") {
      /*
       * WAJIB, dan bukan pemanis — lihat catatan di `closeMobileDrawers`.
       *
       * `validateRequiredSteps()` di atas juga menutup laci, tapi HANYA pada
       * jalur gagalnya. Artinya justru saat rakitannya lengkap dan dialog ini
       * benar-benar terbit, lacinya (`z-[55]`) masih menutupi dialog yang
       * di-portal ke body dengan `z-50`. Yang dialami staff: menekan Print di
       * panel My Build versi mobile, tidak melihat apa-apa, dan quotation tidak
       * pernah terbit karena formulir identitas pelanggannya tidak bisa
       * disentuh. Berlaku untuk kedua mode dialog — `"sendiri"` maupun
       * `"oper"`. Kasus yang sama sudah lebih dulu diperbaiki di
       * `handleOpenSaveDialog`.
       */
      closeMobileDrawers()
      setIsQuotationDialogOpen(true)
      return
    }

    await terbitkanDanCetak({})
  }

  /**
   * Menerbitkan quotation lewat server action, lalu membuka halaman cetaknya.
   *
   * Dulu tombol Print cuma membuka `/build-pc/print?items=…` dan halaman itulah
   * yang menulis ke database. Sejak kodenya berupa nomor urut, menulis saat GET
   * jadi tidak bisa dipertahankan: refresh tab PDF akan memakan nomor baru.
   * Sekarang nomor terbit SEKALI di sini, dan halaman cetak hanya membaca.
   *
   * Yang dikirim tetap hanya id & kuantitas plus identitas pelanggan — harga
   * dibaca ulang dari katalog di server, jadi harga di PDF tidak bisa dipalsukan
   * lewat inspect element di halaman ini (CLAUDE.md §2.7).
   */
  const terbitkanDanCetak = async (
    identitas: Partial<QuotationFormValues>,
  ): Promise<{ ok: boolean; error?: string }> => {
    const items = kumpulkanItems()

    // Tab disiapkan SEBELUM await: browser hanya mengizinkan membuka tab selama
    // gestur klik masih berjalan. Lihat `prepareInternalOpen`.
    const tab = prepareInternalOpen()
    setIssuingQuote(true)
    try {
      const hasil = await issueQuotationAction({ items, ...identitas })
      if (!hasil.ok) {
        tab.cancel()
        /**
         * Kegagalan pada alur berdialog dikembalikan ke DIALOG, bukan dijadikan
         * toast: yang harus dibetulkan ada di formulir itu sendiri, dan menutup
         * dialog untuk memunculkan toast berarti isian yang sudah diketik hilang.
         */
        if (Object.keys(identitas).length > 0) return { ok: false, error: hasil.error }

        toastManager.add({
          title: "Quotation gagal diterbitkan",
          description: hasil.error,
          data: { variant: "danger" },
        })
        return { ok: false, error: hasil.error }
      }
      tab.go(printHref(hasil.code, hasil.token))
      return { ok: true }
    } catch (error) {
      console.error("[build-pc] gagal menerbitkan quotation:", error)
      tab.cancel()
      const pesan = "Periksa koneksi lalu coba lagi."
      if (Object.keys(identitas).length === 0) {
        toastManager.add({
          title: "Quotation gagal diterbitkan",
          description: pesan,
          data: { variant: "danger" },
        })
      }
      return { ok: false, error: pesan }
    } finally {
      setIssuingQuote(false)
    }
  }


  /**
   * Menyimpan revisi, lalu membuka halaman cetaknya. Kode TIDAK berubah.
   *
   * Yang dikirim: id & kuantitas komponen, identitas pelanggan, dan satu
   * BOOLEAN `useLatestPrices`. Tidak ada rupiah yang berangkat dari sini —
   * server yang memutuskan tiap baris memakai harga lama atau harga katalog
   * (CLAUDE.md §2.7).
   */
  const handleSimpanRevisi = async () => {
    if (!revisionLoad) return
    if (!validateRequiredSteps()) return
    if (issuingQuote) return

    const items = kumpulkanItems()
    if (items.length === 0) {
      toastManager.add({
        title: "Rakitan Kosong",
        description: "Revisi tidak bisa disimpan tanpa komponen.",
        data: { variant: "danger" },
      })
      return
    }

    const tab = prepareInternalOpen()
    setIssuingQuote(true)
    try {
      const hasil = await reviseQuotationAction({
        code: revisionLoad.code,
        items,
        customerName: revisionLoad.customerName,
        customerPhone: revisionLoad.customerPhone,
        internalNote: revisionLoad.internalNote,
        useLatestPrices: pakaiHargaTerbaru,
      })

      if (!hasil.ok) {
        tab.cancel()
        toastManager.add({
          title: "Revisi gagal disimpan",
          description: hasil.error,
          data: { variant: "danger" },
        })
        return
      }

      tab.go(printHref(hasil.code, hasil.token))
    } catch (error) {
      console.error("[build-pc] gagal menyimpan revisi:", error)
      tab.cancel()
      toastManager.add({
        title: "Revisi gagal disimpan",
        description: "Periksa koneksi lalu coba lagi.",
        data: { variant: "danger" },
      })
    } finally {
      setIssuingQuote(false)
    }
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
          data: { variant: "danger" },
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

  /**
   * Menutup KEDUA laci mobile. WAJIB dipanggil sebelum membuka dialog apa pun
   * dari dalam laci.
   *
   * Laci duduk di `z-[55]`, sedangkan seluruh dialog project ini (Dialog dan
   * AlertDialog, lihat `components/ui/dialog.tsx`) di-portal ke body dengan
   * `z-50`. Artinya dialog yang dibuka selagi laci terbuka memang muncul di
   * DOM, tapi seluruhnya tertutup laci: pelanggan menekan "Simpan" di panel My
   * Build versi mobile, tidak melihat apa-apa, dan rakitannya tidak pernah
   * tersimpan karena formulirnya tidak bisa disentuh.
   *
   * Menutup lacinya — bukan menaikkan z-index dialog — karena lacinya memang
   * sudah selesai tugasnya begitu aksi di dalamnya ditekan, dan menaikkan
   * z-index satu dialog berarti mengubah tumpukan untuk seluruh halaman lain
   * yang memakai dialog yang sama.
   */
  const closeMobileDrawers = () => {
    setIsMobileMyBuildOpen(false)
    setIsMobileStepsOpen(false)
  }

  /**
   * Tombol Reset. Dulu memanggil `window.confirm` langsung, dan itu
   * memunculkan kotak peringatan bawaan peramban di tengah alur yang seluruh
   * dialog lainnya sudah memakai komponen sendiri — di sebagian peramban
   * mobile kotak itu bahkan menyebut nama domain dan menawarkan "cegah halaman
   * ini membuat dialog lagi", yang kalau ditekan membuat tombol Reset diam
   * seterusnya.
   */
  const handleRequestReset = () => {
    closeMobileDrawers()
    setIsResetConfirmOpen(true)
  }

  const handleOpenSaveDialog = () => {
    if (buildLineItems().length === 0) {
      toastManager.add({
        title: "Build Kosong",
        description: "Belum ada komponen yang dipilih.",
      })
      return
    }

    // Dua dialog bisa lahir dari sini, dan dua-duanya akan tertimbun laci
    // mobile kalau lacinya dibiarkan terbuka.
    closeMobileDrawers()

    /*
     * Dialog, BUKAN `window.location.href = "/login..."` seperti sebelumnya.
     * Lompatan itu membuang halaman tepat setelah pelanggan selesai menyusun
     * belasan komponen — tanpa sepatah kata, dan yang muncul formulir login
     * yang tidak ia minta. Dialog menahan halamannya: rakitan tetap utuh di
     * layar, dan "Nanti saja" mengembalikannya ke pekerjaannya.
     */
    if (!isLoggedIn) {
      setIsLoginPromptOpen(true)
      return
    }

    setSaveDialogIsForNewBuild(false)
    setIsSaveDialogOpen(true)
  }

  const handleConfirmSaveBuild = async (name: string) => {
    return saveBuildAction(name, buildLineItems())
  }

  /**
   * Satu varian dipilih dari `VariationPickerDialog`.
   *
   * Yang masuk rakitan adalah BARIS VARIANNYA (`variation.id`), bukan induknya.
   * Baris varian juga sebuah `Product` dengan harga, stok, dan SKU sendiri,
   * jadi seluruh jalur hilir — penetapan harga katalog, quotation cetak, pesan
   * WhatsApp, rakitan tersimpan — tidak perlu tahu apa pun soal varian: bagi
   * mereka ia produk biasa dengan id biasa. Inilah alasan pendekatan ini
   * dipilih, dan ia sudah dipakai lebih dulu oleh pemuatan paket PC Prebuild di
   * `app/build-pc/page.tsx`.
   *
   * `attributes` sengaja diwarisi dari INDUK, bukan dari baris variannya.
   * Atribut sebuah varian adalah atribut pembedanya (Kapasitas, Warna); socket
   * sebuah motherboard tidak pernah tercatat di sana. Memakai atribut varian
   * akan membuat langkah yang bergantung pada socket membuang pilihan yang
   * sebenarnya cocok — diam-diam, tanpa pesan apa pun.
   */
  const handlePickVariation = (parent: BuilderProduct, variation: BuilderVariation) => {
    if (!activeStep) return

    const item: BuilderProduct = {
      ...parent,
      id: variation.id,
      price: variation.price,
      regularPrice: variation.regularPrice,
      salePrice: variation.salePrice,
      stock: variation.stock,
      image: variation.image ?? parent.image,
      type: "VARIATION",
      // `parent.parentId ?? parent.id`: kartunya bisa berupa induk asli dari
      // grid, atau induk yang dipulihkan dari pilihan yang sudah ada di
      // rakitan. Keduanya harus menghasilkan id induk yang sama.
      parentId: parent.parentId ?? parent.id,
      parentName: parent.name,
      variationLabel: variation.label,
      variations: parent.variations,
    }

    selectProduct(activeStep.id, item)
    dismissMissingStepToast()
    toastManager.add({
      title: "Komponen Ditambahkan",
      description: `${activeStep.name}: ${variation.label}`,
      timeout: 2000,
      data: { variant: "success" },
    })

    // Di langkah yang cuma menampung satu komponen, opsi berikutnya MENGGANTI
    // yang barusan dipilih — membiarkan dialognya terbuka di sana hanya
    // mengundang salah tekan. Di langkah yang boleh berisi banyak (Storage,
    // RAM), dialognya justru dibiarkan terbuka supaya dua varian bisa diambil
    // berturut-turut tanpa membukanya dua kali.
    //
    // Dua layar bisa memanggil ini: `VariationPickerDialog` dan daftar opsi di
    // dalam Quick Preview. Keduanya ditutup tanpa dipilah — yang sedang tertutup
    // memang tidak berubah apa-apa, dan hanya SATU dari keduanya yang pernah
    // terbuka pada saat yang sama.
    if (!activeStep.allowMultiple) {
      setIsVariationPickerOpen(false)
      setIsQuickViewOpen(false)
    }
  }

  /**
   * Satu kartu komponen dipilih — dari tombol di kartunya maupun dari dalam
   * Quick Preview.
   *
   * Produk bervarian TIDAK PERNAH masuk rakitan langsung: harga induknya sering
   * nol dan bukan harga barang mana pun (CLAUDE.md §2.7), jadi yang terjadi
   * adalah pemilih variannya yang dibuka. Quick Preview tidak pernah sampai ke
   * cabang itu — di sana daftar variannya sudah tampil di dalam dialog, karena
   * dialog di project ini tidak boleh dirantai (lihat berkas dialognya).
   */
  const handleSelectProduct = (product: BuilderProduct) => {
    if (!activeStep) return

    if ((product.variations?.length ?? 0) > 0) {
      setVariationPicker(product)
      setIsVariationPickerOpen(true)
      return
    }

    selectProduct(activeStep.id, product)
    dismissMissingStepToast()
    toastManager.add({
      title: "Komponen Ditambahkan",
      description: `${activeStep.name} berhasil dipilih`,
      timeout: 2000,
      data: { variant: "success" },
    })
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
    closeMobileDrawers()
    setSaveDialogIsForNewBuild(true)
    setIsSaveDialogOpen(true)
  }

  const selectedStepsCount = steps.filter(s => Array.isArray(selections[s.id]) && selections[s.id].length > 0).length
  const totalSteps = steps.length

  /** Langkah sesudah yang sedang dibuka, atau `undefined` kalau ini yang terakhir. */
  const nextStep =
    activeStepIndex >= 0 && activeStepIndex < totalSteps - 1
      ? steps[activeStepIndex + 1]
      : undefined

  /** Langkah sebelum yang sedang dibuka, atau `undefined` kalau ini yang pertama. */
  const prevStep = activeStepIndex > 0 ? steps[activeStepIndex - 1] : undefined

  /**
   * Aksi "Kembali" pada bar aksi mobile.
   *
   * Sengaja TIDAK memanggil pengingat langkah wajib seperti `handleAdvanceStep`.
   * Pengingat itu masuk akal saat orang meninggalkan sebuah langkah untuk maju;
   * memunculkannya saat mereka mundur untuk membetulkan sesuatu justru
   * menegur orang yang sedang menuju perbaikan.
   */
  const handleGoBackStep = () => {
    if (!prevStep) return

    setActiveStep(prevStep.id)
    setIsMobileMyBuildOpen(false)
    setIsMobileStepsOpen(false)
  }

  /**
   * Aksi "Lanjut" pada bar aksi mobile.
   *
   * MENGINGATKAN, bukan memblokir. Langkah wajib yang masih kosong cuma
   * memunculkan toast lalu perpindahan tetap terjadi: orang yang sedang
   * membandingkan harga sering melewati satu langkah dengan sengaja, dan
   * mengunci mereka di sana membuat builder terasa rusak padahal tidak ada yang
   * salah. Yang belum diisi tidak hilang dari pandangan — ia tetap tercatat di
   * Build Progress dan di hitungan "3/8", dan `validateRequiredSteps` tetap
   * menjaga pintu terakhir — baik saat rakitan dicetak jadi PDF quotation
   * maupun saat ia dikirim ke CS.
   */
  const handleAdvanceStep = () => {
    if (!nextStep) return

    const current = steps[activeStepIndex]
    const currentEmpty =
      !Array.isArray(selections[current.id]) || selections[current.id].length === 0

    if (current.isRequired && currentEmpty) {
      toastManager.add({
        title: `${current.name} belum dipilih`,
        description: "Anda bisa kembali ke langkah ini kapan saja.",
        timeout: 3000,
      })
    }

    setActiveStep(nextStep.id)
    setIsMobileMyBuildOpen(false)
    setIsMobileStepsOpen(false)
    // Gulir ke atas TIDAK dipanggil di sini: efek yang mengawasi `activeStepId`
    // sudah melakukannya untuk setiap perpindahan langkah, dari mana pun asalnya.
  }

  // Sort selected items to top
  const activeStepSelections = activeStep ? (Array.isArray(selections[activeStep.id]) ? selections[activeStep.id] : []) : []

  /**
   * Kartu di grid adalah INDUK; yang masuk rakitan adalah BARIS VARIANNYA.
   * Karena itu setiap pencocokan "kartu ini sudah dipilih?" harus lewat id
   * kartunya, bukan id baris yang tersimpan — kalau tidak, kartu induk sebuah
   * varian yang sudah dipilih akan tampil seolah belum tersentuh, dan
   * pelanggan memilihnya lagi dari nol.
   */
  const cardIdOf = (product: { id: number; parentId?: number }) => product.parentId ?? product.id

  const selectedCardIds = new Set(activeStepSelections.map(s => cardIdOf(s.product)))

  /**
   * Memulihkan kartu INDUK dari satu pilihan varian yang tersimpan di rakitan.
   *
   * Dipakai hanya untuk komponen yang tidak ada di halaman grid yang sedang
   * dimuat (lihat `selectedButNotLoaded` di bawah). Harga yang dipasang adalah
   * varian termurah yang masih ada stoknya — aturan yang SAMA dengan yang
   * dipakai server saat menyusun kartu induk, lewat fungsi yang sama
   * (`cheapestAvailableVariation`), supaya kartu pulihan ini tidak pernah
   * menampilkan angka yang berbeda dari kartu aslinya.
   */
  const kartuIndukDariPilihan = (product: BuilderProduct): BuilderProduct => {
    if (!product.parentId || !product.variations || product.variations.length === 0) {
      return product
    }

    const termurah = cheapestAvailableVariation(product.variations)

    return {
      ...product,
      id: product.parentId,
      name: product.parentName ?? product.name,
      price: termurah?.price ?? product.price,
      regularPrice: termurah?.regularPrice ?? product.regularPrice,
      salePrice: termurah?.salePrice ?? product.salePrice,
      stock: product.variations.reduce((max, v) => Math.max(max, v.stock), 0),
      parentId: undefined,
      parentName: undefined,
      variationLabel: undefined,
    }
  }

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

  // Dua varian dari induk yang sama menghasilkan SATU kartu, bukan dua — karena
  // itu dikumpulkan lewat Map ber-kunci id kartu, bukan lewat `.map()`.
  const kartuPulihan = new Map<number, BuilderProduct>()
  for (const sel of activeStepSelections) {
    const cardId = cardIdOf(sel.product)
    if (loadedProductIds.has(cardId) || kartuPulihan.has(cardId)) continue

    const kartu = kartuIndukDariPilihan(sel.product)
    if (searchTerm && !kartu.name.toLowerCase().includes(searchTerm)) continue

    kartuPulihan.set(cardId, kartu)
  }
  const selectedButNotLoaded = [...kartuPulihan.values()]

  const sortedProducts = [...selectedButNotLoaded, ...products].sort((a, b) => {
    const aSelected = selectedCardIds.has(a.id)
    const bSelected = selectedCardIds.has(b.id)
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
          onClick={handleRequestReset}
          className="text-xs text-muted-foreground hover:text-red-500 bg-background hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-sm border border-border/50"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>
      {/* `pb-24` versi mobile sudah dilepas: jaraknya dulu mengganjal dua FAB
          bulat yang mengambang di atas laci ini. FAB-nya sudah diganti bar aksi
          di dasar layar, dan bar itu duduk di bawah laci (`z-[45]` lawan
          `z-[55]`), jadi tidak ada lagi yang perlu dihindari — yang tersisa
          hanyalah 96px ruang kosong di ujung gulir. */}
      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1">
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
              className="group relative flex gap-2.5 rounded-lg border border-border/50 bg-card p-2 transition-colors hover:border-border"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white flex items-center justify-center">
                <ProductImage
                  src={sel.product.image}
                  alt={sel.product.name}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                  fallbackClassName="bg-background"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground leading-none">
                  {step.name}
                </div>
                <div className="mt-1 text-xs font-semibold leading-snug line-clamp-2">
                  {sel.product.name}
                </div>
                {/* Opsi varian ditulis sebagai barisnya sendiri, bukan
                    disambung ke nama produk: inilah satu-satunya yang
                    membedakan dua baris yang namanya sama persis, dan ia harus
                    tetap terbaca walau namanya sudah terpotong dua baris di
                    atas. Label yang sama ikut ke PDF quotation, pesan WhatsApp,
                    dan build log di /admin/logs. */}
                {sel.product.variationLabel && (
                  <div className="mt-0.5 inline-flex max-w-full items-center rounded bg-blue-600/10 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-blue-700 dark:text-blue-300">
                    <span className="truncate">{sel.product.variationLabel}</span>
                  </div>
                )}
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
                  // Keadaan `pending` TIDAK ditandai di sini. Ia keadaan yang
                  // paling sering terjadi — setiap komponen yang ditambahkan
                  // setelah katalog dibaca sekali di awal kunjungan masuk ke
                  // sana — sehingga penandanya muncul di hampir semua baris
                  // sekaligus dan terbaca seolah seluruh rakitan bermasalah,
                  // padahal tidak ada satu pun harga yang diketahui salah.
                  //
                  // `loading` dan `error` tetap ditandai: yang satu menerangkan
                  // jeda yang sedang terjadi, yang satu lagi kegagalan nyata.
                  if (priceUnverifiedFor(sel.product) && unverifiedState !== "pending") {
                    return (
                      <UnverifiedPriceNotice
                        state={unverifiedState}
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
              {/* Lihat `displayedTotal` di atas: dijumlahkan dari komponen
                  yang sedang tampil, tidak pernah dari potret `pricing.total`
                  yang hanya dibaca sekali per kunjungan. */}
              {formatRupiah(displayedTotal)}
            </span>
          </div>
          <div className="flex justify-between items-baseline text-[11px] pt-0.5">
            <span className="text-muted-foreground">Komponen dipilih</span>
            <span className="font-semibold">{selectedStepsCount}/{totalSteps}</span>
          </div>

          {/* Kegagalan verifikasi TIDAK memblokir tombol Konsultasi di bawah:
              harga yang dikirim ke CS dibaca ulang di server, jadi pemesanan
              tetap aman walau panel gagal memastikan angkanya di sini. */}
          {/* `unverifiedState !== "pending"` — alasannya sama dengan penanda
              per-baris di atas: kalimat panjang yang selalu tampil berhenti
              dibaca, dan yang tersisa hanyalah kesan bahwa angka di panel ini
              tidak bisa dipegang. Yang menjaga harga bukan kalimat ini,
              melainkan pembacaan ulang di server saat Print dan Konsultasi
              ditekan (lihat `handlePrint` dan `handleCheckoutWA`). */}
          {priceUnverified && unverifiedState !== "pending" && (
            <p
              className={`flex items-center gap-1.5 pt-0.5 text-[10px] leading-tight ${
                pricingError ? "text-sale-red" : "text-muted-foreground"
              }`}
            >
              {unverifiedState === "loading" && (
                <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden="true" />
              )}
              {unverifiedState === "error"
                ? "Harga belum bisa diverifikasi. Angka di atas berasal dari rakitan tersimpan dan mungkin sudah berubah — CS akan mengonfirmasi harga terkini."
                : unverifiedState === "loading"
                  ? "Memeriksa harga terbaru…"
                  : "Ada komponen yang harganya belum diverifikasi ke katalog. Angkanya dipastikan saat Anda menekan Konsultasi."}
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
          {/* Memakai `handleAdvanceStep` yang SAMA dengan bar aksi mobile,
              bukan salinan logikanya. Dua tombol yang sama-sama berarti "maju
              satu langkah" tidak boleh berbeda perilaku — pengingat langkah
              wajib yang kosong harus muncul dari mana pun perpindahan dimulai.

              Labelnya "Lanjut", bukan "Continue": ini teks yang dibaca
              pelanggan, dan CLAUDE.md §7 mewajibkan copywriting UI dalam Bahasa
              Indonesia. */}
          <Button
            onClick={handleAdvanceStep}
            disabled={!nextStep}
            className="w-full cursor-pointer bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold h-10 rounded-lg text-sm transition-colors"
          >
            Lanjut
          </Button>

          {/* Konsultasi WA disembunyikan di Mode Revisi: angka yang tampil
              boleh berbeda dari katalog (itu memang gunanya revisi), sedangkan
              pesan ke CS selalu dibaca ulang dari katalog. Membiarkannya
              berarti sales mengirim total yang tidak sama dengan dokumen yang
              sedang ia susun. */}
          <Button
            onClick={handleCheckoutWA}
            disabled={sendingWA}
            className={`w-full cursor-pointer bg-[#25D366] hover:bg-[#1EBE5A] active:bg-[#17A74C] text-white font-bold h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm transition-colors ${
              revisionLoad ? "hidden" : ""
            }`}
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

        {revisionLoad ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={handleSimpanRevisi}
              disabled={issuingQuote}
              className="cursor-pointer flex items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/75 h-10 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Printer className="w-3.5 h-3.5" />
              {issuingQuote ? "Menyimpan…" : "Simpan Revisi"}
            </button>
            {/* Batal = kembali ke detail quotation, BUKAN mengosongkan rakitan.
                Yang ditinggalkan cuma perubahan yang belum disimpan; dokumen
                yang sudah terbit tidak tersentuh sama sekali. */}
            <a
              href={`/profile/quotation/${encodeURIComponent(revisionLoad.code)}`}
              className="cursor-pointer flex items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-background text-foreground hover:bg-muted h-10 text-sm font-semibold transition-colors"
            >
              Batal
            </a>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* Dinonaktifkan selama penerbitan berjalan: satu klik = satu nomor
                urut, dan klik ganda pada koneksi lambat berarti dua dokumen untuk
                satu rakitan. */}
            <button
              onClick={handlePrint}
              disabled={issuingQuote}
              className="cursor-pointer flex items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/75 h-10 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Printer className="w-3.5 h-3.5" />
              {issuingQuote ? "Menerbitkan…" : "Print"}
            </button>
            <button
              onClick={handleOpenSaveDialog}
              className="cursor-pointer flex items-center justify-center gap-1.5 rounded-lg border border-foreground/15 bg-background text-foreground hover:bg-muted h-10 text-sm font-semibold transition-colors"
            >
              <SaveIcon size={14} />
              Simpan
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* ---------- Bar Mode Revisi ---------- */}
      {revisionLoad && (
        <div className="mb-4 w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">
                Merevisi{" "}
                <span className="font-mono">{revisionLoad.code}</span>{" "}
                <span className="font-sans">
                  · Rev. {revisionLoad.revisiBerlaku} → Rev. {revisionLoad.revisiBerlaku + 1}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pelanggan: <strong>{revisionLoad.customerName || "—"}</strong>. Kode quotation
                tidak berubah; yang bertambah adalah nomor revisinya.
              </p>
            </div>
          </div>

          {/* Komponen yang sudah lenyap dari katalog. Dilaporkan lebih dulu
              karena ia mengubah isi rakitan, bukan cuma angkanya. */}
          {revisionLoad.komponenHilang.length > 0 && (
            <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <strong>{revisionLoad.komponenHilang.length} komponen</strong> dari revisi sebelumnya
              sudah tidak ada di katalog dan tidak ikut dimuat. Tambahkan penggantinya sebelum
              menyimpan.
            </p>
          )}

          {revisionLoad.perubahanHarga.length > 0 && (
            <div className="mt-3 rounded-xl border border-border bg-background/70 p-3">
              <p className="text-xs font-bold">
                {revisionLoad.perubahanHarga.length} item harganya sudah berubah di katalog
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {revisionLoad.perubahanHarga.map((p) => (
                  <li key={p.name} className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="text-muted-foreground line-through">
                        {formatRupiah(p.hargaLama)}
                      </span>{" "}
                      <span className={p.hargaBaru > p.hargaLama ? "font-bold text-destructive" : "font-bold text-brand-green"}>
                        {formatRupiah(p.hargaBaru)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {/* Mati secara bawaan. Harga yang sudah dipegang pelanggan
                  dipertahankan kecuali sales memilih sebaliknya — menaikkannya
                  diam-diam saat sales cuma menambah satu komponen adalah cara
                  tercepat kehilangan kepercayaan pelanggan. */}
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={pakaiHargaTerbaru}
                  onChange={(e) => setPakaiHargaTerbaru(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer"
                />
                <span>
                  <strong>Gunakan harga terbaru</strong> untuk semua komponen.
                  <span className="block text-muted-foreground">
                    Kalau dibiarkan mati, harga revisi sebelumnya dipertahankan. Komponen yang baru
                    ditambahkan selalu memakai harga katalog.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
      )}

    <div className="flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto w-full pb-[124px] md:pb-0">

      {/*
        BAR AKSI MOBILE — menggantikan dua FAB bulat yang dulu mengambang di
        `bottom-24 right-4`.

        Masukan dari pengguna mobile: setelah memilih komponen mereka tidak tahu
        harus menekan apa untuk lanjut. Memang tidak ada yang bisa ditekan —
        satu-satunya tombol "Continue" duduk DI DALAM panel My Build, yang hanya
        terbuka lewat lingkaran hitam berikon disket. Ikon disket berarti
        "simpan" bagi siapa pun, jadi tidak ada alasan menekannya, dan langkah
        berikutnya jadi tidak pernah ditemukan.

        Karena itu aksi lanjutnya sekarang duduk permanen di layar, bukan di
        balik ikon. Kedua laci tetap ada, tapi pemicunya kini punya nama.

        `bottom-[60px]`: tepat di atas MobileDock (tinggi 60px, `fixed bottom-0`
        — lihat mobile-dock.tsx). Dock sengaja TIDAK disembunyikan di sini
        seperti yang dilakukan halaman produk: di `/build-pc` Header versi
        mobile juga sudah disembunyikan, jadi menghilangkan dock akan menyisakan
        halaman tanpa satu pun jalan keluar selain tombol back peramban.

        `z-[45]`: di bawah laci (`z-[55]`) dan tirainya (`z-[50]`) supaya bar
        ini ikut tertutup saat laci terbuka — barnya tidak boleh mengambang di
        atas panel yang baru saja ia buka.

        FloatingWhatsAppButton tidak perlu diperhitungkan: ia sudah
        menyembunyikan dirinya di `/build-pc` (lihat `hasOwnWhatsAppCta`).
      */}
      <div className="fixed inset-x-0 bottom-[60px] z-[45] md:hidden print:hidden border-t border-border bg-[var(--background-50)] shadow-[0_-4px_20px_rgba(0,0,0,0.14)]">
        <div className="flex items-stretch gap-2 px-3 py-2">
          {/*
            Sisi kiri: harga sebagai INFORMASI, lalu dua pil berlabel.

            Dua versi sebelumnya gagal di tempat yang sama, dan sebabnya baru
            jelas setelah dipakai: harganya dijadikan tombol, dengan chevron
            polos sebagai satu-satunya penanda. Tidak ada yang menduga chevron
            itu membuka panel berisi Print/PDF, Simpan, dan Konsultasi — satu
            penguji malah mengiranya pemindah langkah. Akibatnya empat aksi
            terpenting di halaman ini praktis tidak pernah ditemukan.

            Pelajarannya: chevron menempel pada angka bukan penanda tujuan, ia
            cuma penanda "ada sesuatu". Jadi harga dikembalikan menjadi apa
            adanya — tidak bisa diklik, merah seperti total di keranjang dan di
            panel My Build — dan setiap tujuan diberi pil berbingkai dengan
            namanya tertulis.
          */}
          <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-1">
            {/* `text-sale-red`: konvensi total di seluruh project (lihat
                CartView dan ringkasan My Build di berkas ini). Sebelumnya warna
                teks biasa, dan itu membuat satu-satunya angka rupiah di layar
                justru tidak terbaca sebagai harga. */}
            <span className="max-w-full truncate text-[13px] font-black leading-tight text-sale-red tabular-nums">
              {formatRupiah(displayedTotal)}
            </span>

            <div className="flex max-w-full items-center gap-1.5">
              {/* Lompat ke langkah mana pun. Kembali/Lanjut cuma bergerak satu
                  langkah; pil ini membuka daftar lengkapnya, dan itu tetap
                  satu-satunya cara menuju langkah yang jauh. Angkanya POSISI
                  langkah — sama persis dengan `3/8` di bar mengambang atas,
                  karena keduanya membuka daftar yang sama. Hitungan "Komponen
                  dipilih" tetap ada di panel My Build. */}
              <button
                onClick={() => {
                  setIsMobileStepsOpen(true)
                  setIsMobileMyBuildOpen(false)
                }}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors active:bg-muted"
                aria-label={`Langkah ${activeStepIndex + 1} dari ${totalSteps}. Ketuk untuk lompat ke langkah lain.`}
              >
                <Stack3Icon size={10} />
                <span className="leading-tight">
                  {activeStepIndex + 1}/{totalSteps}
                </span>
              </button>

              {/* Pil inilah satu-satunya jalan ke Print/PDF, Simpan, dan
                  Konsultasi, jadi ia WAJIB berlabel kata — bukan ikon, bukan
                  chevron sendirian. `aria-label` menyebut ketiga aksinya supaya
                  pengguna pembaca layar tidak perlu membuka panel untuk tahu
                  isinya. */}
              <button
                onClick={() => {
                  setIsMobileMyBuildOpen(true)
                  setIsMobileStepsOpen(false)
                }}
                className="flex min-w-0 cursor-pointer items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors active:bg-muted"
                aria-label="Lihat rakitan: cetak PDF, simpan rakitan, atau konsultasi via WhatsApp"
              >
                <span className="truncate leading-tight">Rakitan</span>
                <ChevronUp className="h-2.5 w-2.5 shrink-0" />
              </button>
            </div>
          </div>

          {/*
            Kembali & Lanjut — DUA-DUANYA berlabel kata.

            Bentuk ini menggantikan tombol tunggal "Lanjut ke <nama langkah>".
            Alasannya dua, dan keduanya datang dari pemakaian nyata:

            1. Nama langkah BUKAN konstanta — staff mengetiknya di admin lewat
               input teks tanpa batas panjang (lihat step-card.tsx), jadi "Power
               Supply Unit (PSU)" sama mungkinnya dengan "RAM". Label tetap
               membuat lebar tombol tidak lagi bergantung pada data, sehingga
               tidak ada lagi yang perlu dipotong elipsis.
            2. Tidak ada kontrol "mundur" yang terlihat sebelumnya. Satu-satunya
               jalan ke langkah sebelumnya adalah membuka daftar langkah, dan
               orang tidak menemukannya.

            Yang dikorbankan: label lama menyebutkan langkah berikutnya. Itu
            ditebus bar mengambang atas, yang selalu menampilkan nama langkah
            aktif dan berubah seketika saat Lanjut ditekan.

            Ikon polos sengaja DIHINDARI di sini. Dua kali berturut-turut
            penanda tanpa kata di halaman ini terbukti tidak terbaca; tombol
            paling penting di layar bukan tempat untuk mencobanya lagi.
          */}
          {/* `grid-cols-2`: kedua tombol WAJIB selebar satu sama lain. Dengan
              flex biasa lebarnya mengikuti panjang katanya masing-masing,
              sehingga "Kembali" selalu lebih besar dari "Lanjut" dan pasangan
              yang seharusnya setara terlihat timpang. Grid memberi keduanya
              satu ukuran: yang terlebar menentukan, yang lain menyesuaikan —
              termasuk saat "Lanjut" berganti menjadi "Konsultasi" di langkah
              terakhir. */}
          <div className="grid shrink-0 grid-cols-2 items-center gap-1.5">
            {/* Di langkah pertama tombolnya DINONAKTIFKAN, bukan disembunyikan:
                kontrol yang muncul-hilang membuat tata letak melompat dan
                memindahkan tombol Lanjut tepat saat jari hendak menekannya. */}
            <Button
              onClick={handleGoBackStep}
              disabled={!prevStep}
              variant="outline"
              className="h-auto w-full cursor-pointer gap-0.5 rounded-xl px-2 py-2 text-xs font-bold"
              aria-label={prevStep ? `Kembali ke ${prevStep.name}` : "Sudah di langkah pertama"}
            >
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
              Kembali
            </Button>

            {nextStep ? (
              <Button
                onClick={handleAdvanceStep}
                className="h-auto w-full cursor-pointer gap-0.5 rounded-xl bg-blue-600 px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
                aria-label={`Lanjut ke ${nextStep.name}`}
              >
                Lanjut
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              </Button>
            ) : revisionLoad ? null : (
              /* Langkah terakhir: tidak ada lagi tempat untuk maju, jadi
                 tombolnya berganti peran menjadi aksi penutup. Handler-nya SAMA
                 PERSIS dengan tombol Konsultasi di panel My Build — termasuk
                 `validateRequiredSteps` dan pembacaan ulang harga di server.

                 Di Mode Revisi slot ini dikosongkan, dengan alasan yang sama
                 seperti di panel My Build. Tombol "Kembali" di sebelahnya tetap
                 ada — navigasi antar langkah bukan yang dipermasalahkan §2.7. */
              <Button
                onClick={handleCheckoutWA}
                disabled={sendingWA}
                className="h-auto w-full cursor-pointer gap-1 rounded-xl bg-[#25D366] px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1EBE5A] active:bg-[#17A74C]"
              >
                {sendingWA ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">
                  {sendingWA ? "Menyiapkan…" : "Konsultasi"}
                </span>
              </Button>
            )}
          </div>
        </div>
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

            `mt-[60px] md:mt-0`: berbeda dari `<h1>` desktop di bawah (yang
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
          /* Warnanya tetap amber, BUKAN biru seperti banner di bawah: ini
             banner peringatan — menekan tombolnya membuang rakitan yang sedang
             disusun. Yang dinaikkan cuma kontrasnya, mengikuti perlakuan yang
             sama dengan banner "rakitan sebelumnya": tulisan hitam di atas
             amber pastel, tombol berlatar putih yang menjadi gelap saat
             disentuh. */
          <div className="mb-6 mt-[60px] md:mt-0 flex flex-col items-start gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-neutral-900 dark:border-amber-800/60 dark:bg-amber-200/90 dark:text-neutral-900 print:hidden sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <span className="font-bold">Muat paket &ldquo;{presetLoad.name}&rdquo;?</span>{" "}
              Rakitan yang sedang kamu susun akan diganti.
            </div>
            <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => {
                  hydrateSelections(presetLoad.selections)
                  setPresetPending(false)
                  setShowPreviousBuildBanner(false)
                }}
                className="cursor-pointer rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-neutral-900 shadow-sm transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
              >
                Muat paket
              </button>
              <button
                onClick={() => setPresetPending(false)}
                className="cursor-pointer rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-900/10"
              >
                Pertahankan rakitan saya
              </button>
            </div>
          </div>
        )}

        {showPreviousBuildBanner && (
          /* Latar biru pastel dengan tulisan HITAM, bukan biru di atas biru.
             Versi sebelumnya memakai `text-blue-800` di atas `bg-blue-50` —
             dua warna bertetangga yang membuat kalimatnya nyaris menyatu dengan
             latarnya dan susah dibaca.

             Warnanya ditulis eksplisit (`bg-blue-100`, `text-neutral-900`) dan
             TIDAK ikut berbalik di mode gelap: banner ini harus tetap kartu
             pastel bertulisan hitam di kedua tema, sama seperti banner amber di
             atasnya. Karena itu varian `dark:` di sini menyetel ulang ke nilai
             terang, bukan menggelapkannya. */
          <div className="mb-6 mt-[60px] md:mt-0 flex flex-col items-start gap-2 rounded-xl border border-blue-300 bg-blue-100 px-4 py-3 text-sm text-neutral-900 dark:border-blue-700/60 dark:bg-blue-200/90 dark:text-neutral-900 print:hidden sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 shrink-0" />
              <span className="font-semibold">Melanjutkan rakitan sebelumnya</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => setIsStartNewDialogOpen(true)}
                className="cursor-pointer rounded-lg border border-blue-400 bg-white px-3 py-1.5 text-xs font-bold text-neutral-900 shadow-sm transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
              >
                Mulai Rakitan Baru
              </button>
              <button
                onClick={() => setShowPreviousBuildBanner(false)}
                aria-label="Tutup pemberitahuan"
                className="cursor-pointer rounded-lg border border-transparent p-1.5 text-neutral-900 transition-colors hover:bg-neutral-900/10"
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
          <div className="md:hidden fixed top-0 left-0 right-0 z-[45] p-2 pointer-events-none">
            {/* Tingginya dipangkas dari tiga baris menjadi DUA: kolom cari dan
                kedua tombol urut sekarang berbagi satu baris. Bar ini `fixed`
                di puncak layar, jadi setiap piksel tingginya dibayar dua kali —
                sekali oleh dirinya sendiri, sekali lagi oleh `mt` yang harus
                mengganjal grid produk di bawahnya. Padding, jarak antarbaris,
                dan ukuran teksnya ikut diturunkan satu tingkat. */}
            <div className="bg-background/80 backdrop-blur-xl border shadow-lg rounded-2xl p-2 pointer-events-auto flex flex-col gap-1.5">
              {/* Nama step ikut di dalam bar mengambang. Kalau ditaruh di alur
                  normal halaman (seperti <h1> versi desktop), bar ini menutupinya
                  begitu halaman digulir — padahal justru saat menggulir daftar
                  panjang pengguna perlu tahu sedang memilih komponen apa.

                  Namanya SEKALIGUS pemicu daftar langkah, dengan chevron ke
                  bawah sebagai penandanya. Inilah tempat orang pertama kali
                  mencari saat bertanya "saya di langkah mana, dan bagaimana
                  pindah?" — menaruh satu-satunya jalan pindah di tempat lain
                  membuat pertanyaan itu tidak pernah terjawab.

                  `<button>` dibungkus `<h1>`, bukan sebaliknya: isi `<button>`
                  hanya boleh phrasing content, sedangkan `<h1>` bukan — menaruh
                  judulnya di dalam tombol menghasilkan HTML yang tidak sah. */}
              <div className="flex items-baseline justify-between gap-2">
                <h1 className="min-w-0 flex-1 text-sm font-extrabold tracking-tight">
                  <button
                    onClick={() => {
                      setIsMobileStepsOpen(true)
                      setIsMobileMyBuildOpen(false)
                    }}
                    className="flex w-full cursor-pointer items-center gap-1 text-left"
                    aria-label={`Langkah ${activeStepIndex + 1} dari ${totalSteps}: ${activeStep.name}. Ketuk untuk pindah langkah.`}
                  >
                    <span className="truncate">{activeStep.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </h1>
                <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                  {activeStepIndex + 1}/{totalSteps}
                </span>
              </div>

              {/* Kolom cari dan tombol urut SATU baris. Tombolnya menyusut
                  ke lebar isinya (`shrink-0`, bukan `flex-1`) supaya sisa
                  ruangnya jatuh ke kolom cari — itu yang paling sering dipakai.
                  Label "Price" diterjemahkan jadi "Harga": teks ini dibaca
                  pelanggan, dan CLAUDE.md §7 mewajibkan Bahasa Indonesia. */}
              <div className="flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-[9px] h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={`Cari ${activeStep.name}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 rounded-lg bg-card border-border/50 text-xs"
                  />
                </div>
                <button 
                  onClick={() => {
                    if (sortMode === "name_asc") setSortMode("name_desc")
                    else if (sortMode === "name_desc") setSortMode("default")
                    else setSortMode("name_asc")
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="cursor-pointer shrink-0 h-8 px-2 bg-muted text-foreground rounded-lg text-[10px] font-bold hover:bg-muted/80 active:scale-95 transition-all whitespace-nowrap"
                >
                  A-Z {sortMode === "name_asc" ? "↓" : sortMode === "name_desc" ? "↑" : ""}
                </button>
                <button 
                  onClick={() => {
                    if (sortMode === "price_asc") setSortMode("price_desc")
                    else setSortMode("price_asc")
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="cursor-pointer shrink-0 h-8 px-2 bg-muted text-foreground rounded-lg text-[10px] font-bold hover:bg-muted/80 active:scale-95 transition-all whitespace-nowrap"
                >
                  Harga {sortMode === "price_asc" ? "↓" : sortMode === "price_desc" ? "↑" : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Jarak atas di mobile menyesuaikan tinggi bar mengambang dikurangi
            `py-8` milik pembungkus halaman, supaya kartu pertama tidak tertutup
            tapi juga tidak menyisakan celah kosong berlebih.

            Dulu `112px`, saat barnya masih tiga baris (judul / kolom cari /
            tombol sort). Sejak kolom cari dan tombol urut disatukan, barnya
            setinggi ~84px dari puncak layar: pembungkus `p-2` (8) + kartu
            [`p-2` (8) + judul 20 + `gap-1.5` (6) + baris cari 32 + `p-2` (8) +
            border 2]. Dikurangi `py-8` (32) menyisakan 52px, dibulatkan ke 60
            supaya kartu pertama punya sedikit napas dari tepi bawah bar.

            Angka ini WAJIB ikut berubah setiap kali tinggi bar berubah — ia
            dipakai di TIGA tempat (dua banner + grid ini), dan kalau tertinggal
            gejalanya bukan error melainkan elemen yang diam-diam tertutup. */}
        <div className="md:mt-0 mt-[60px]">
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
                  // Satu kartu induk bisa menyumbang BEBERAPA baris rakitan
                  // (dua NVMe berbeda kapasitas), jadi yang dikumpulkan di sini
                  // adalah seluruh barisnya, bukan satu.
                  const barisKartu = activeStepSelections.filter(
                    s => cardIdOf(s.product) === product.id
                  )
                  const quantity = barisKartu.reduce((total, s) => total + s.quantity, 0)

                  // Disaring dengan `parentId`, BUKAN dengan `variationLabel`:
                  // varian yang kebetulan tidak punya nilai atribut sama sekali
                  // tetap sebuah varian, dan membuangnya di sini akan membuat
                  // kartunya tampak terpilih tapi tanpa satu pun pengatur
                  // kuantitas — tidak bisa dikurangi, tidak bisa dihapus.
                  const selectedVariations: SelectedVariationLine[] = barisKartu
                    .filter(s => s.product.parentId)
                    .map(s => ({
                      variationId: s.product.id,
                      label: s.product.variationLabel ?? s.product.name,
                      quantity: s.quantity,
                      // Stok dari daftar varian kartu ini kalau ada — itu hasil
                      // pembacaan katalog barusan, sedangkan angka di dalam
                      // pilihan tersimpan bisa berumur berminggu-minggu.
                      stock:
                        product.variations?.find(v => v.id === s.product.id)?.stock ??
                        s.product.stock,
                    }))

                  return (
                    <ProductCardBuilder 
                      key={product.id}
                      product={product}
                      quantity={quantity}
                      onSelect={() => handleSelectProduct(product)}
                      onQuickView={() => {
                        setQuickViewProduct(product)
                        setIsQuickViewOpen(true)
                      }}
                      onUpdateQuantity={(q) => updateQuantity(activeStep!.id, product.id, q)}
                      onUpdateVariationQuantity={(variationId, q) =>
                        updateQuantity(activeStep!.id, variationId, q)
                      }
                      selectedVariations={selectedVariations}
                      allowMultiple={activeStep?.allowMultiple ?? false}
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

      {/* Hanya untuk staff. Pengunjung tidak pernah melihat dialog ini — tombol
          Print mereka langsung menerbitkan dokumen anonim. */}
      {quotationMode !== "anon" && (
        <IssueQuotationDialog
          open={isQuotationDialogOpen}
          onOpenChange={setIsQuotationDialogOpen}
          mode={quotationMode}
          salesOptions={salesOptions}
          onSubmit={terbitkanDanCetak}
        />
      )}

      <SaveBuildDialog
        open={isSaveDialogOpen}
        onOpenChange={(next) => {
          setIsSaveDialogOpen(next)
          if (!next) setSaveDialogIsForNewBuild(false)
        }}
        onConfirm={handleConfirmSaveBuild}
        onSaved={saveDialogIsForNewBuild ? handleDiscardAndStartNew : undefined}
      />

      {/*
        `next` menunjuk /build-pc tanpa query. Rakitan yang sedang disusun
        hidup di store terpisah yang bertahan lintas muat halaman, bukan di
        URL, jadi pelanggan yang kembali setelah masuk menemukannya utuh.
      */}
      <LoginPromptDialog
        open={isLoginPromptOpen}
        onOpenChange={setIsLoginPromptOpen}
        nextPath="/build-pc"
        description="Rakitan Anda tersimpan di akun, jadi bisa dibuka lagi kapan saja dari perangkat mana pun. Rakitan yang sedang Anda susun tidak hilang."
      />

      {/* SELALU dirender — lihat catatan "Selalu ter-mount" di
          variation-picker-dialog.tsx. Membungkusnya dalam `{variationPicker &&
          …}` membuat dialognya tidak pernah sempat terlihat. */}
      <VariationPickerDialog
        open={isVariationPickerOpen}
        onOpenChange={(next) => {
          if (!next) setIsVariationPickerOpen(false)
        }}
        product={variationPicker}
        selectedVariationIds={
          variationPicker
            ? activeStepSelections
                .filter((s) => cardIdOf(s.product) === variationPicker.id)
                .map((s) => s.product.id)
            : []
        }
        onPick={(variation) => {
          if (variationPicker) handlePickVariation(variationPicker, variation)
        }}
      />

      {/* SELALU dirender, alasannya sama dengan pemilih varian di atas. */}
      <BuilderQuickViewDialog
        open={isQuickViewOpen}
        onOpenChange={(next) => {
          if (!next) setIsQuickViewOpen(false)
        }}
        product={quickViewProduct}
        selectedQuantity={
          quickViewProduct
            ? activeStepSelections
                .filter((s) => cardIdOf(s.product) === quickViewProduct.id)
                .reduce((total, s) => total + s.quantity, 0)
            : 0
        }
        selectedVariationIds={
          quickViewProduct
            ? activeStepSelections
                .filter((s) => cardIdOf(s.product) === quickViewProduct.id)
                .map((s) => s.product.id)
            : []
        }
        allowMultiple={activeStep?.allowMultiple ?? false}
        onSelect={() => {
          if (!quickViewProduct) return
          handleSelectProduct(quickViewProduct)
          // Produk biasa saja yang sampai ke sini (produk bervarian memakai
          // daftar opsi di dalam dialog), jadi pilihannya sudah selesai dan
          // pratinjaunya tidak punya alasan untuk tetap terbuka.
          setIsQuickViewOpen(false)
        }}
        onPickVariation={(variation) => {
          if (quickViewProduct) handlePickVariation(quickViewProduct, variation)
        }}
      />

      {/* Konfirmasi Reset. Rakitan baru dikosongkan setelah pelanggan menekan
          tombol merahnya — `clearSelections` tidak pernah dipanggil dari
          tempat lain selain di sini dan `handleDiscardAndStartNew`. */}
      <ConfirmDialog
        open={isResetConfirmOpen}
        onOpenChange={setIsResetConfirmOpen}
        title="Reset semua pilihan?"
        description="Seluruh komponen yang sudah Anda pilih akan dikeluarkan dari rakitan ini. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Reset Rakitan"
        destructive
        onConfirm={() => {
          clearSelections()
          setShowPreviousBuildBanner(false)
        }}
      />

      <StartNewBuildDialog
        open={isStartNewDialogOpen}
        onOpenChange={setIsStartNewDialogOpen}
        isLoggedIn={isLoggedIn}
        onSaveFirst={handleSaveFirst}
        onDiscard={handleDiscardAndStartNew}
      />
    </div>
    </>
  )
}
