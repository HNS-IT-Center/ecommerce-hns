"use client"

import { useEffect, useRef } from "react"
import { useSidebar } from "@/components/ui/sidebar"

/**
 * Admin Swipe Gesture hook
 * Opens sidebar on confident right-to-left swipe.
 *
 * Arahnya mengikuti sisi munculnya panel (`mobileSide="right"` di AppSidebar):
 * panel yang masuk dari kanan ditarik dengan usapan KE KIRI, seolah menyeret
 * panelnya keluar. Usapan ke arah berlawanan akan terasa seperti mendorong
 * panel menjauh justru untuk memunculkannya.
 *
 * Rules:
 * - Gesture must start anywhere on screen (not just edge)
 * - Only fires when swipe is clearly horizontal (ratio check)
 * - Does NOT fire if the touch started inside a horizontally scrollable element
 * - Does NOT fire if the user is primarily scrolling vertically
 */
export function useAdminSwipeGesture() {
  const { openMobile, setOpenMobile } = useSidebar()
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const isHorizontalScroll = useRef(false)

  useEffect(() => {
    const MIN_SWIPE_DISTANCE = 60   // px horizontal travel required
    const MAX_ANGLE_RATIO = 0.5     // dy/dx must be < 0.5 (shallow angle)
    const MIN_VELOCITY = 0.3        // px/ms to count as intentional

    // Check if the touch target is inside a horizontally scrollable container
    function isInsideHorizontalScroller(el: Element | null): boolean {
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el)
        const overflow = style.overflowX
        if ((overflow === "auto" || overflow === "scroll") && el.scrollWidth > el.clientWidth) {
          return true
        }
        el = el.parentElement
      }
      return false
    }

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY }
      isHorizontalScroll.current = isInsideHorizontalScroller(e.target as Element)
    }

    function onTouchEnd(e: TouchEvent) {
      if (!touchStart.current) return
      if (isHorizontalScroll.current) {
        touchStart.current = null
        return
      }

      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = touch.clientY - touchStart.current.y
      const duration = e.timeStamp - (e as any).startTime || 300

      // Must be moving left (panel masuk dari kanan)
      if (dx > 0) {
        touchStart.current = null
        return
      }

      const distance = Math.abs(dx)

      // Angle check: horizontal must dominate
      const angleRatio = Math.abs(dy) / distance
      if (angleRatio > MAX_ANGLE_RATIO) {
        touchStart.current = null
        return
      }

      // Distance check
      if (distance < MIN_SWIPE_DISTANCE) {
        touchStart.current = null
        return
      }

      // Open sidebar if it is currently closed
      if (!openMobile) {
        setOpenMobile(true)
      }

      touchStart.current = null
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchend", onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [openMobile, setOpenMobile])
}
