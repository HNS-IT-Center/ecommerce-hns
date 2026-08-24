"use client"

import Image from "next/image"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import { ChevronLeft, ChevronRight, X, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { getVideoEmbed, getVideoPosterUrl } from "@/lib/utils/product"

export type GalleryImage = {
  src: string
  alt: string
  /**
   * Label varian pemilik gambar ini, mis. "MERAH". Diisi hanya untuk gambar
   * yang berasal dari sebuah varian; gambar produk induk membiarkannya kosong.
   */
  variantLabel?: string
}

interface ProductGalleryProps {
  images: GalleryImage[]
  videoUrl?: string | null
  /**
   * Slide yang harus ditampilkan, dikendalikan dari luar. Dipakai halaman
   * produk supaya memilih varian ikut melompatkan galeri ke gambarnya.
   * `null` berarti galeri mengatur dirinya sendiri.
   */
  activeIndexOverride?: number | null
  /** Dipanggil setiap slide berpindah, termasuk oleh swipe dan tombol panah. */
  onActiveIndexChange?: (index: number) => void
}

type Slide =
  | { kind: "image"; image: GalleryImage }
  | { kind: "video" }

export function ProductGallery({
  images,
  videoUrl,
  activeIndexOverride = null,
  onActiveIndexChange,
}: ProductGalleryProps) {
  const [isVideoOpen, setIsVideoOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoEmbed = videoUrl ? getVideoEmbed(videoUrl) : null
  const videoPoster = videoUrl ? getVideoPosterUrl(videoUrl) : null
  const [internalIndex, setActiveIndex] = useState(0)

  /**
   * Video adalah slide penuh di posisi kedua, bukan bendera di atas foto utama.
   *
   * Daftar slide dirakit di sini alih-alih di server supaya `images` tetap murni
   * berisi gambar: `variantImageIndex` yang dikirim halaman produk menunjuk ke
   * indeks array gambar, dan menyisipkan video di sana akan menggeser seluruh
   * penunjuk varian. Dengan pemisahan ini, kedua sistem indeks hidup
   * berdampingan dan diterjemahkan lewat sepasang fungsi di bawah.
   */
  const slides: Slide[] = videoEmbed
    ? [
        { kind: "image", image: images[0] },
        { kind: "video" },
        ...images.slice(1).map((image): Slide => ({ kind: "image", image })),
      ]
    : images.map((image): Slide => ({ kind: "image", image }))

  /** Indeks gambar (dari luar) → indeks slide (di dalam galeri). */
  const toSlideIndex = (imageIndex: number) =>
    videoEmbed && imageIndex >= 1 ? imageIndex + 1 : imageIndex

  /** Indeks slide → indeks gambar. Slide video sendiri mengembalikan `null`. */
  const toImageIndex = (slideIndex: number): number | null => {
    if (!videoEmbed) return slideIndex
    if (slideIndex === 1) return null
    return slideIndex > 1 ? slideIndex - 1 : slideIndex
  }

  /**
   * Nilai dari luar menang tanpa disalin ke state lewat effect.
   *
   * Menyalinnya akan menciptakan sumber kebenaran kedua yang bisa tertinggal
   * satu render, dan proyek ini juga menghindari setState di dalam effect.
   * Dibaca langsung saat render, indeksnya selalu mutakhir.
   */
  const activeIndex =
    activeIndexOverride !== null && activeIndexOverride >= 0 && activeIndexOverride < images.length
      ? toSlideIndex(activeIndexOverride)
      : internalIndex

  const activeSlide = slides[activeIndex]
  const isVideoSlide = activeSlide?.kind === "video"
  const [direction, setDirection] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [magnifierStyle, setMagnifierStyle] = useState({ display: 'none', top: 0, left: 0, bgPosX: 0, bgPosY: 0 })
  const imageRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  /**
   * Geseran yang baru saja terjadi, supaya klik yang menyusulnya bisa diabaikan.
   *
   * Lapisan penangkap geseran menerima `click` juga — dan setiap geseran
   * berakhir dengan satu. Tanpa penanda ini, menggeser foto di mobile langsung
   * membuka lightbox begitu jari diangkat. Disimpan di ref, bukan state: yang
   * membacanya hanya penangan klik sesudahnya, dan mengubah state di sini akan
   * memicu render ulang yang tidak mengubah apa pun yang terlihat.
   */
  const didDragRef = useRef(false)
  const [isMobile, setIsMobile] = useState(true) // Default true, verify on mount

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      // Scroll horizontally instead of vertically when hovering over thumbnails
      if (e.deltaY !== 0) {
        e.preventDefault()
        container.scrollLeft += e.deltaY
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [])

  if (images.length === 0) {
    return (
      <div className="aspect-square w-full rounded-2xl bg-background flex items-center justify-center drop-shadow-sm">
        <span className="text-muted-foreground">No Image</span>
      </div>
    )
  }

  /**
   * Hentikan video dan kembalikan kanvas ke foto.
   *
   * Dipanggil eksplisit dari setiap jalur yang mengganti gambar, bukan lewat
   * effect yang mengamati `activeIndex` — proyek ini melarang setState di dalam
   * effect, dan lagi pula pemicunya memang selalu sebuah aksi pengguna.
   *
   * `pause()` dipanggil lebih dulu untuk berkas video biasa; untuk sematan
   * YouTube/Vimeo, melepas iframe-nya dari DOM yang menghentikan pemutaran —
   * tanpa itu suaranya tetap terdengar walau gambarnya sudah tidak tampak.
   */
  const closeVideo = () => {
    videoRef.current?.pause()
    setIsVideoOpen(false)
  }

  /**
   * Satu pintu untuk setiap perpindahan slide, dari sumber mana pun (tombol
   * panah, swipe, klik thumbnail). Menyiarkan indeks barunya ke pemanggil
   * supaya pilihan varian di luar bisa ikut menyesuaikan.
   */
  const goToIndex = (next: number, dir: number) => {
    closeVideo()
    setDirection(dir)
    setActiveIndex(next)

    // Slide video bukan milik varian mana pun, jadi tidak ada indeks gambar yang
    // bisa disiarkan ke luar — pilihan varian dibiarkan apa adanya.
    const imageIndex = toImageIndex(next)
    if (imageIndex !== null) onActiveIndexChange?.(imageIndex)
  }

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    goToIndex((activeIndex + 1) % slides.length, 1)
  }

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    goToIndex((activeIndex - 1 + slides.length) % slides.length, -1)
  }

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, { offset }: PanInfo) => {
    const swipe = offset.x
    didDragRef.current = Math.abs(swipe) > 5

    if (swipe < -50) {
      handleNext()
    } else if (swipe > 50) {
      handlePrev()
    }
  }

  /**
   * Klik di kanvas, diterima lapisan penangkap geseran yang menutupi semuanya.
   *
   * Karena lapisan itu duduk di atas poster video, tombol play di bawahnya tidak
   * lagi bisa ditekan langsung — jadi maksud kliknya diterjemahkan di sini:
   * di slide video berarti "putar", di slide foto berarti "buka lightbox".
   */
  const handleCanvasClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }

    if (isVideoSlide) {
      if (!isVideoOpen) setIsVideoOpen(true)
      return
    }

    handleImageClick()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile || !imageRef.current) return
    
    const { left, top, width, height } = imageRef.current.getBoundingClientRect()
    const x = e.clientX - left
    const y = e.clientY - top
    
    // Calculate percentage for background position
    const bgPosX = (x / width) * 100
    const bgPosY = (y / height) * 100
    
    setMagnifierStyle({
      display: 'block',
      left: x - 50, // radius 50px
      top: y - 50,
      bgPosX,
      bgPosY,
    })
  }

  const handleMouseLeave = () => {
    setMagnifierStyle((prev) => ({ ...prev, display: 'none' }))
  }

  const handleImageClick = () => {
    // Saat slide video sedang tampil — entah masih poster atau sudah diputar —
    // kanvas ini milik video; klik di atasnya tidak boleh membuka lightbox foto.
    if (isVideoOpen || isVideoSlide) return
    if (isMobile) {
      setIsLightboxOpen(true)
    }
  }

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 100 : -100,
      opacity: 0,
    }),
  }

  return (
    <div className="space-y-8 min-w-0 w-full">
      {/* Main Image Container.

          Di mobile kanvas ini melebar sampai tepi layar dan melepas sudut
          membulatnya — halaman produk menaikkannya sampai menyentuh puncak
          layar dengan header melayang di atasnya, dan sudut membulat di sana
          akan menyisakan celah latar di kedua pojok atas. Dari `sm` ke atas
          bentuknya kembali seperti semula: kartu membulat di dalam grid. */}
      <div
        ref={imageRef}
        /* Di mobile tingginya dipatok 50% layar (`h-[50dvh]`), bukan mengikuti
           `aspect-square`. Kanvas persegi memakan hampir seluruh lipatan
           pertama di ponsel dan mendorong nama serta harga produk ke bawah
           garis lipat — pembeli harus menggulir dulu sebelum melihat angka yang
           justru dicarinya. Setengah layar masih menyisakan ruang untuk nama
           dan harga di lipatan pertama, sambil memberi foto porsi yang lebih
           layak. Dari `sm` ke atas bentuk perseginya kembali, karena di sana
           galeri hanya mengisi satu kolom dari dua.

           `dvh`, bukan `vh`: di browser ponsel `vh` diukur dari viewport saat
           bilah alamat tersembunyi, jadi kanvasnya lebih tinggi dari layar yang
           benar-benar terlihat saat halaman pertama dibuka. `dvh` ikut tinggi
           viewport yang sedang berlaku, sehingga 50% memang 50% dari yang
           dilihat pembeli. */
        className="group relative w-full h-[50dvh] sm:h-auto sm:aspect-square sm:max-h-[500px] overflow-hidden rounded-none sm:rounded-2xl bg-background drop-shadow-sm flex items-center justify-center cursor-pointer sm:cursor-crosshair"
        onClick={handleImageClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Penanda varian pemilik gambar ini. Muncul saat pembeli menggulir
            galeri sampai ke foto sebuah varian, supaya jelas warna/ukuran mana
            yang sedang dilihat — tanpa ini foto-foto varian tampak seperti
            deretan foto produk yang sama. */}
        {/* Di mobile label ini duduk di kiri-BAWAH, sejajar dengan penghitung
            "3/7" di kanan-bawah dan tidak lagi menutupi foto dari atas.

            `max-w-[60%]` + `truncate` menjaganya tidak pernah tumbuh sampai
            menabrak penghitung itu: nama varian di katalog ini bisa sepanjang
            "PUTIH / 32 INCH / 165HZ", dan tanpa batas lebar ia akan menindih
            angkanya di layar sempit. Dari `sm` ke atas ia kembali ke kanan-atas,
            tempat penghitungnya memang tidak dilukis. */}
        {activeSlide?.kind === "image" && activeSlide.image.variantLabel && (
          <span className="absolute bottom-3 left-3 z-40 max-w-[60%] truncate rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md sm:bottom-auto sm:left-auto sm:right-3 sm:top-3 sm:max-w-none">
            {activeSlide.image.variantLabel}
          </span>
        )}

        {/* Poster slide video: pembeli melihat sampul dan menekan play dulu,
            video tidak pernah berjalan sendiri saat digeser ke sini. Posternya
            memakai thumbnail resmi YouTube bila ada; Vimeo dan file R2 tidak
            punya sampul beralamat tetap, jadi jatuh ke foto utama produk yang
            digelapkan supaya tombol play tetap terbaca di atasnya. */}
        {/* `pointer-events-none`: kliknya ditangani lapisan geseran di atasnya
            (lihat `handleCanvasClick`), yang menerjemahkan tekanan di slide ini
            jadi "putar video". Tetap sebuah <button> supaya pembaca layar
            membacanya sebagai kontrol, dan `tabIndex={-1}` mencegahnya jadi
            perhentian keyboard yang tidak melakukan apa-apa saat ditekan. */}
        {isVideoSlide && !isVideoOpen && (
          <button
            type="button"
            onClick={() => setIsVideoOpen(true)}
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black cursor-pointer group/video"
            aria-label="Putar video produk"
          >
            <Image
              src={videoPoster ?? images[0].src}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className={cn(
                "pointer-events-none",
                videoPoster ? "object-cover opacity-80" : "object-contain opacity-40",
              )}
            />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl transition-transform group-hover/video:scale-110">
              <Play className="ml-1 h-7 w-7 fill-current text-foreground" />
            </span>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              Putar Video
            </span>
          </button>
        )}

        {/* Video diputar DI DALAM kanvas gambar utama, bukan di modal terpisah:
            pembeli tetap berada di konteks galeri, dan thumbnail di bawah masih
            terlihat sehingga bisa langsung berpindah ke foto lain. */}
        {videoEmbed && isVideoOpen && (
          <div className="absolute inset-0 z-40 bg-black">
            {videoEmbed.kind === "iframe" ? (
              <iframe
                src={`${videoEmbed.src}?autoplay=1`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                src={videoEmbed.src}
                controls
                autoPlay
                className="h-full w-full object-contain"
              />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                closeVideo()
              }}
              className="absolute right-2 top-2 z-50 flex items-center gap-1 rounded-full bg-black/70 py-1.5 pl-2 pr-3 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/90 cursor-pointer"
              aria-label="Tutup video dan kembali ke foto"
            >
              <X className="h-3.5 w-3.5" />
              Tutup
            </button>
          </div>
        )}

        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="absolute inset-0 p-6 sm:p-10"
          >
            {activeSlide?.kind === "image" && (
              <Image
                src={activeSlide.image.src}
                alt={activeSlide.image.alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain pointer-events-none"
                priority
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Lapisan penangkap geseran, terpisah dari slide yang beranimasi.

            Dulu `drag` menempel di `motion.div` gambar di atas, yang duduk di
            bawah poster video dan pemutarnya (keduanya `z-40`). Akibatnya di
            slide video seluruh sentuhan diserap lapisan video, dan galeri
            berhenti bisa digeser di sana — pembeli yang videonya ada di slide
            kedua tidak punya jalan untuk sampai ke foto ketiga dan seterusnya.

            Sekarang penangkapnya berdiri sendiri di `z-[41]`, di atas video
            (`z-40`) — jadi geseran selalu tertangkap di slide mana pun.

            Tombol panah karena itu WAJIB di atas `41`; sekarang `z-50`. Dulu
            keduanya `z-40` dengan alasan "panah dilukis belakangan jadi tetap
            di atas" — urutan paint hanya menentukan saat `z-index`-nya sama,
            dan `41 > 40` membuat lapisan ini menelan setiap klik panah. Panahnya
            tetap muncul saat hover (`group-hover` menyala dari kontainer, bukan
            dari tombolnya), tapi tidak bisa ditekan sama sekali di desktop:
            kliknya jatuh ke `handleCanvasClick`, yang di desktop tidak berbuat
            apa-apa. Kalau lapisan ini naik lagi suatu hari, naikkan panahnya.
            `pointer-events-none` saat videonya benar-benar diputar: di sana
            kontrol pemutar yang harus menerima sentuhan, bukan galeri.

            `touch-pan-y` menjaga gulungan vertikal halaman tetap normal; hanya
            geseran mendatar yang diambil. Tanpa `dragMomentum={false}` lapisan
            ini akan meluncur sendiri setelah dilepas dan meleset dari posisinya. */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          onClick={handleCanvasClick}
          className={cn(
            "absolute inset-0 z-[41] touch-pan-y",
            isVideoOpen && "pointer-events-none",
          )}
          aria-hidden="true"
        />

        {/* Desktop Zoom Effect. Tidak berlaku di slide video — kacanya akan
            menutupi poster dan pemutarnya. */}
        {!isMobile && !isVideoSlide && magnifierStyle.display === 'block' && activeSlide?.kind === "image" && (
          <div
            className="absolute inset-0 z-30 pointer-events-none bg-background"
            style={{
              backgroundImage: `url(${activeSlide.image.src})`,
              backgroundPosition: `${magnifierStyle.bgPosX}% ${magnifierStyle.bgPosY}%`,
              backgroundSize: '150%', // 1.5x zoom
              backgroundRepeat: 'no-repeat',
            }}
          />
        )}

        {/* Hover Navigation Arrows (Desktop mostly) */}
        {slides.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-background/50 text-foreground backdrop-blur-md opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:bg-background/80 cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-background/50 text-foreground backdrop-blur-md opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:bg-background/80 cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </>
        )}

        {/* Penghitung slide, mis. "3/7".

            Ini pengganti peran deretan thumbnail yang di mobile sudah diganti
            oleh pemilih varian: tanpa sesuatu yang memberi tahu jumlah foto,
            pembeli tidak punya alasan untuk mencoba menggeser sama sekali.
            Videonya ikut dihitung karena ia memang satu slide penuh di sini,
            jadi angkanya cocok dengan yang benar-benar bisa digeser. */}
        {slides.length > 1 && (
          <span
            className="absolute bottom-3 right-3 z-40 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-md sm:hidden"
            aria-hidden="true"
          >
            {activeIndex + 1}/{slides.length}
          </span>
        )}
      </div>

      {/* Thumbnails — desktop saja.

          Di mobile tempat ini diambil alih pemilih varian: barisnya cuma muat
          satu deret, dan memilih varian lebih berharga daripada melompat antar
          foto yang toh bisa digeser langsung di kanvas. Penghitung "3/7" di
          sudut gambar yang menggantikan perannya sebagai penunjuk jumlah foto. */}
      {slides.length > 1 && (
        <div
          ref={scrollContainerRef}
          className="hidden sm:flex gap-3 overflow-x-auto p-2 scrollbar-hide snap-x snap-mandatory scroll-smooth w-full"
        >
          {slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => goToIndex(i, i > activeIndex ? 1 : -1)}
              className={cn(
                "relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl transition-all bg-background drop-shadow-sm cursor-pointer snap-center",
                i === activeIndex
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-70 hover:opacity-100"
              )}
              aria-label={slide.kind === "video" ? "Video produk" : undefined}
            >
              {slide.kind === "video" ? (
                <>
                  {/* Thumbnail video sengaja gelap dan bertanda play supaya
                      terbaca sebagai "bisa diputar", bukan sekadar foto lain. */}
                  <Image
                    src={videoPoster ?? images[0].src}
                    alt=""
                    fill
                    sizes="96px"
                    className={cn(
                      "pointer-events-none",
                      videoPoster ? "object-cover opacity-70" : "object-contain p-2 opacity-30",
                    )}
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-md">
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-current text-foreground" />
                    </span>
                  </span>
                </>
              ) : (
                <Image
                  src={slide.image.src}
                  alt={slide.image.alt}
                  fill
                  sizes="96px"
                  className="object-cover p-2 pointer-events-none"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal (Mobile mainly) */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-10 backdrop-blur-sm"
            onClick={() => setIsLightboxOpen(false)}
          >
            <button 
              className="absolute right-4 top-4 z-[110] rounded-full bg-white/10 p-2 text-white hover:bg-white/20 backdrop-blur-md cursor-pointer"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
            
            <div 
              className="relative h-full w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatePresence initial={false} custom={direction}>
                <motion.div
                  key={activeIndex}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.8}
                  onDragEnd={handleDragEnd}
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                  }}
                  className="absolute inset-0 touch-none"
                >
                  {activeSlide?.kind === "image" && (
                    <Image
                      src={activeSlide.image.src}
                      alt={activeSlide.image.alt}
                      fill
                      sizes="100vw"
                      className="object-contain pointer-events-none"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {slides.length > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 z-[110] flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 cursor-pointer"
                  >
                    <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 z-[110] flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 cursor-pointer"
                  >
                    <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
