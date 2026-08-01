"use client"

import { useEffect } from "react"

export function PrintClientComponent() {
  useEffect(() => {
    // Wait a brief moment for images to render before triggering print
    const timer = setTimeout(() => {
      window.print()
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  return null
}
