"use client"

import { useEffect, type RefObject } from "react"
import type { UseEmblaCarouselType } from "embla-carousel-react"

type EmblaApi = UseEmblaCarouselType[1]

/**
 * Memutar carousel Embla secara otomatis — dan, yang sebenarnya jadi inti hook
 * ini, MENJEDANYA di setiap keadaan yang membuat gerakan itu mubazir atau
 * mengganggu.
 *
 * Sebelumnya hero dan Deals sama-sama memakai `setInterval` polos yang hidup
 * selama komponen ter-mount. Empat akibatnya:
 *
 * 1. Tab di latar belakang. Peramban cuma me-throttle `setInterval`, tidak
 *    menghentikannya, sementara animasi Embla berjalan di atas
 *    `requestAnimationFrame` yang MEMANG berhenti saat tab tersembunyi. Jadi
 *    indeks slide terus maju tanpa ada yang menontonnya, dan begitu pengunjung
 *    kembali, banner sudah meloncat ke slide entah ke berapa.
 * 2. Menyela tidak me-reset hitungan. Pengunjung menekan panah, lalu tersenggol
 *    lagi oleh putaran otomatis beberapa ratus milidetik kemudian.
 * 3. Hover tidak menjeda. Kursor yang sedang mengarah ke tombol CTA kehilangan
 *    sasarannya karena slide-nya keburu bergeser.
 * 4. `prefers-reduced-motion` diabaikan, padahal gerakan berulang tanpa henti
 *    persis yang dihindari setelan itu.
 *
 * Jeda nomor 3 juga menjawab WCAG 2.2.2 (Pause, Stop, Hide): konten yang
 * bergerak otomatis lebih dari lima detik harus bisa dihentikan pengunjung.
 *
 * @param api          Instance Embla; `undefined` sebelum carousel siap.
 * @param delayMs      Jeda antar slide.
 * @param containerRef Elemen yang dipantau hover & fokusnya. Default-nya
 *                     `api.rootNode()` — cukup kalau tombol panah/titik berada
 *                     DI DALAM root Embla. Hero menaruhnya di luar (overlay
 *                     absolute), jadi di sana wrapper terluar yang dioper,
 *                     supaya menggeser kursor ke tombol panah tidak terbaca
 *                     sebagai "keluar dari carousel" dan menyalakan putaran
 *                     otomatis tepat sebelum diklik.
 */
export function useCarouselAutoplay(
  api: EmblaApi,
  delayMs: number,
  containerRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!api) return

    const container = containerRef?.current ?? api.rootNode()
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    let timer: number | undefined
    let hovered = false
    let focused = false
    let dragging = false

    const stop = () => {
      if (timer === undefined) return
      window.clearInterval(timer)
      timer = undefined
    }

    const canPlay = () =>
      !hovered &&
      !focused &&
      !dragging &&
      !reducedMotion.matches &&
      document.visibilityState === "visible"

    /**
     * Selalu mulai dari nol. Dipanggil juga lewat "select", sehingga navigasi
     * apa pun — panah, titik, atau geseran jari — memberi slide berikutnya
     * jatah waktu penuh alih-alih sisa hitungan yang sedang berjalan.
     */
    const restart = () => {
      stop()
      if (!canPlay()) return
      timer = window.setInterval(() => api.scrollNext(), delayMs)
    }

    const onMouseEnter = () => {
      hovered = true
      stop()
    }
    const onMouseLeave = () => {
      hovered = false
      restart()
    }
    const onFocusIn = () => {
      focused = true
      stop()
    }
    const onFocusOut = () => {
      focused = false
      restart()
    }
    const onPointerDown = () => {
      dragging = true
      stop()
    }
    const onPointerUp = () => {
      dragging = false
      restart()
    }

    // `mouseenter`/`mouseleave`, bukan padanan pointer-nya: pada layar sentuh
    // `pointerleave` tidak selalu menyusul `pointerenter`, dan carousel-nya
    // akan terkunci menjeda selamanya sesudah satu sentuhan.
    container.addEventListener("mouseenter", onMouseEnter)
    container.addEventListener("mouseleave", onMouseLeave)
    container.addEventListener("focusin", onFocusIn)
    container.addEventListener("focusout", onFocusOut)
    document.addEventListener("visibilitychange", restart)
    reducedMotion.addEventListener("change", restart)
    api.on("select", restart)
    api.on("pointerDown", onPointerDown)
    api.on("pointerUp", onPointerUp)

    restart()

    return () => {
      stop()
      container.removeEventListener("mouseenter", onMouseEnter)
      container.removeEventListener("mouseleave", onMouseLeave)
      container.removeEventListener("focusin", onFocusIn)
      container.removeEventListener("focusout", onFocusOut)
      document.removeEventListener("visibilitychange", restart)
      reducedMotion.removeEventListener("change", restart)
      api.off("select", restart)
      api.off("pointerDown", onPointerDown)
      api.off("pointerUp", onPointerUp)
    }
  }, [api, delayMs, containerRef])
}
