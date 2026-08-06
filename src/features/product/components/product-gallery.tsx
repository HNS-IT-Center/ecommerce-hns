"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVideoEmbed } from "@/lib/utils/product";

interface ProductGalleryProps {
  images: Array<{ src: string; alt: string }>;
  videoUrl?: string | null;
}

export function ProductGallery({ images, videoUrl }: ProductGalleryProps) {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoEmbed = videoUrl ? getVideoEmbed(videoUrl) : null;
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [magnifierStyle, setMagnifierStyle] = useState({
    display: "none",
    top: 0,
    left: 0,
    bgPosX: 0,
    bgPosY: 0,
  });
  const imageRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(true); // Default true, verify on mount

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Scroll horizontally instead of vertically when hovering over thumbnails
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  if (images.length === 0) {
    return (
      <div className="aspect-square w-full rounded-2xl bg-background flex items-center justify-center drop-shadow-sm">
        <span className="text-muted-foreground">No Image</span>
      </div>
    );
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
    videoRef.current?.pause();
    setIsVideoOpen(false);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    closeVideo();
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    closeVideo();
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    { offset }: PanInfo,
  ) => {
    const swipe = offset.x;
    if (swipe < -50) {
      handleNext();
    } else if (swipe > 50) {
      handlePrev();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile || !imageRef.current) return;

    const { left, top, width, height } =
      imageRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    // Calculate percentage for background position
    const bgPosX = (x / width) * 100;
    const bgPosY = (y / height) * 100;

    setMagnifierStyle({
      display: "block",
      left: x - 50, // radius 50px
      top: y - 50,
      bgPosX,
      bgPosY,
    });
  };

  const handleMouseLeave = () => {
    setMagnifierStyle((prev) => ({ ...prev, display: "none" }));
  };

  const handleImageClick = () => {
    // Saat video sedang diputar, kanvas ini milik video — klik di atasnya tidak
    // boleh membuka lightbox foto.
    if (isVideoOpen) return;
    if (isMobile) {
      setIsLightboxOpen(true);
    }
  };

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
  };

  return (
    <div className="space-y-8 min-w-0 w-full">
      {/* Main Image Container */}
      <div
        ref={imageRef}
        className="group relative w-full aspect-square max-h-[350px] sm:max-h-[500px] overflow-hidden rounded-2xl bg-background drop-shadow-sm flex items-center justify-center cursor-pointer sm:cursor-crosshair"
        onClick={handleImageClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Bendera video di gambar utama. Hanya di indeks 0 karena video adalah
            pendamping gambar utama, bukan slide tersendiri. */}
        {videoEmbed && activeIndex === 0 && !isVideoOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsVideoOpen(true);
            }}
            className="absolute left-3 top-3 z-40 flex items-center gap-1.5 rounded-full bg-black/70 py-1.5 pl-2 pr-3 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/85 cursor-pointer"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Play className="h-2.5 w-2.5 fill-current text-primary-foreground" />
            </span>
            Video
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
                e.stopPropagation();
                closeVideo();
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
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.8}
            onDragEnd={handleDragEnd}
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="absolute inset-0 p-6 sm:p-10 touch-pan-y"
          >
            <Image
              src={images[activeIndex].src}
              alt={images[activeIndex].alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain pointer-events-none"
              priority
            />
          </motion.div>
        </AnimatePresence>

        {/* Desktop Zoom Effect */}
        {!isMobile && magnifierStyle.display === "block" && (
          <div
            className="absolute inset-0 z-30 pointer-events-none bg-background"
            style={{
              backgroundImage: `url(${images[activeIndex].src})`,
              backgroundPosition: `${magnifierStyle.bgPosX}% ${magnifierStyle.bgPosY}%`,
              backgroundSize: "150%", // 1.5x zoom
              backgroundRepeat: "no-repeat",
            }}
          />
        )}

        {/* Hover Navigation Arrows (Desktop mostly) */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-background/50 text-foreground backdrop-blur-md opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:bg-background/80 cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-background/50 text-foreground backdrop-blur-md opacity-0 shadow-sm transition-all group-hover:opacity-100 hover:bg-background/80 cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto p-2 scrollbar-hide snap-x snap-mandatory scroll-smooth w-full"
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => {
                closeVideo();
                setDirection(i > activeIndex ? 1 : -1);
                setActiveIndex(i);
              }}
              className={cn(
                "relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl transition-all bg-background drop-shadow-sm cursor-pointer snap-center",
                i === activeIndex
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-70 hover:opacity-100",
              )}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="96px"
                className="object-cover p-2 pointer-events-none"
              />
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
                  <Image
                    src={images[activeIndex].src}
                    alt={images[activeIndex].alt}
                    fill
                    sizes="100vw"
                    className="object-contain pointer-events-none"
                  />
                </motion.div>
              </AnimatePresence>

              {images.length > 1 && (
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
  );
}
