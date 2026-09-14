"use client"

import { useEffect, useMemo, useRef, type PointerEvent } from "react"

/** Geser jari lebih jauh dari ini dianggap menggeser, bukan mengetuk. */
const TAP_SLOP_PX = 10

/** Tekanan lebih lama dari ini dianggap menahan, bukan mengetuk. */
const TAP_MAX_MS = 350

type UseCameraGesturesOptions = {
  zoom: number
  minZoom: number
  maxZoom: number
  onZoomChange: (zoom: number) => void
  /** Ketukan satu jari, dalam koordinat layar (`clientX`/`clientY`). */
  onTap: (clientX: number, clientY: number) => void
}

type Point = { x: number; y: number }

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Pinch untuk zoom dan ketuk untuk fokus di atas tampilan kamera.
 *
 * Memakai Pointer Events, bukan Touch Events, supaya satu jalur kode berlaku di
 * Android, iPhone, dan layar sentuh laptop. Elemen penerimanya WAJIB diberi
 * `touch-action: none` — tanpa itu browser merebut pinch untuk memperbesar
 * halaman, dan event-nya dibatalkan sebelum sampai ke sini.
 *
 * Zoom mengikuti rasio jarak dua jari terhadap jarak saat pinch dimulai, jadi
 * rasanya sama seperti memperbesar foto: jari melebar dua kali lipat, zoom ikut
 * dua kali lipat dari posisi awalnya.
 */
export function useCameraGestures({
  zoom,
  minZoom,
  maxZoom,
  onZoomChange,
  onTap,
}: UseCameraGesturesOptions) {
  /**
   * Nilai terkini dititipkan lewat ref supaya handler yang dikembalikan tetap
   * stabil — handler baru di setiap render berarti listener dilepas-pasang
   * puluhan kali per detik selama pinch berlangsung.
   */
  const latestRef = useRef({ zoom, minZoom, maxZoom, onZoomChange, onTap })
  useEffect(() => {
    latestRef.current = { zoom, minZoom, maxZoom, onZoomChange, onTap }
  }, [zoom, minZoom, maxZoom, onZoomChange, onTap])

  const pointersRef = useRef(new Map<number, Point>())
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null)
  const tapRef = useRef<{ id: number; x: number; y: number; time: number } | null>(null)

  return useMemo(() => {
    // `pointersRef.current` dibaca di dalam tiap handler, tidak di sini: badan
    // `useMemo` berjalan saat render, dan membaca ref saat render dilarang.
    const startPinch = () => {
      const [a, b] = Array.from(pointersRef.current.values())
      pinchRef.current = { startDistance: distance(a, b), startZoom: latestRef.current.zoom }
    }

    const release = (event: PointerEvent<HTMLElement>, isCancel: boolean) => {
      const pointers = pointersRef.current
      pointers.delete(event.pointerId)

      const tap = tapRef.current
      if (
        !isCancel &&
        tap?.id === event.pointerId &&
        performance.now() - tap.time <= TAP_MAX_MS
      ) {
        latestRef.current.onTap(tap.x, tap.y)
      }
      if (tap?.id === event.pointerId) tapRef.current = null

      if (pointers.size >= 2) {
        // Jari ketiga yang terangkat — lanjutkan pinch dari dua jari tersisa.
        startPinch()
      } else {
        pinchRef.current = null
      }
    }

    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        const pointers = pointersRef.current
        event.currentTarget.setPointerCapture(event.pointerId)
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

        if (pointers.size === 1) {
          tapRef.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            time: performance.now(),
          }
        } else {
          // Jari kedua turun: ini pinch, bukan ketukan.
          tapRef.current = null
          startPinch()
        }
      },

      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const pointers = pointersRef.current
        if (!pointers.has(event.pointerId)) return
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

        const tap = tapRef.current
        if (
          tap?.id === event.pointerId &&
          Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > TAP_SLOP_PX
        ) {
          tapRef.current = null
        }

        const pinch = pinchRef.current
        if (!pinch || pointers.size < 2 || pinch.startDistance <= 0) return

        const [a, b] = Array.from(pointers.values())
        const { minZoom: min, maxZoom: max, onZoomChange: change } = latestRef.current
        const next = pinch.startZoom * (distance(a, b) / pinch.startDistance)
        // Dibulatkan ke 0,01 supaya getaran jari sepersekian piksel tidak
        // memicu render dan permintaan ke kamera yang tidak mengubah apa pun.
        change(Math.round(Math.min(max, Math.max(min, next)) * 100) / 100)
      },

      onPointerUp: (event: PointerEvent<HTMLElement>) => release(event, false),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => release(event, true),
    }
  }, [])
}
