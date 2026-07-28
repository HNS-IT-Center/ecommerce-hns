"use client"

import React, { useRef, useState, useEffect } from "react"
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"

export interface DockItem {
  icon: React.ReactNode
  label: string
  href?: string
  onClick?: () => void
  isActive?: boolean
}

export interface SpringOptions {
  stiffness?: number
  damping?: number
  mass?: number
}

interface DockProps {
  items: DockItem[]
  magnification?: number
  distance?: number
  iconSize?: number
  gap?: number
  alwaysShowLabels?: boolean
  springOptions?: SpringOptions
  className?: string
}

export function Dock({
  items,
  magnification = 1.8,
  distance = 100,
  iconSize = 40,
  gap = 8,
  alwaysShowLabels = false,
  springOptions = { stiffness: 300, damping: 22, mass: 0.5 },
  className,
}: DockProps) {
  const mouseX = useMotionValue(Infinity)
  const [isHovered, setIsHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={(e) => {
        setIsHovered(true)
        mouseX.set(e.pageX)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        mouseX.set(Infinity)
      }}
      className={cn(
        "relative mx-auto flex items-end bg-background/80 backdrop-blur-md shadow-lg border-t",
        className
      )}
      style={{
        gap,
        padding: gap,
      }}
    >
      {items.map((item, index) => (
        <DockIcon
          key={index}
          item={item}
          mouseX={mouseX}
          isHovered={isHovered}
          magnification={magnification}
          distance={distance}
          iconSize={iconSize}
          alwaysShowLabels={alwaysShowLabels}
          springOptions={springOptions}
        />
      ))}
    </motion.div>
  )
}

interface DockIconProps {
  item: DockItem
  mouseX: any
  isHovered: boolean
  magnification: number
  distance: number
  iconSize: number
  alwaysShowLabels: boolean
  springOptions: SpringOptions
}

function DockIcon({
  item,
  mouseX,
  isHovered,
  magnification,
  distance,
  iconSize,
  alwaysShowLabels,
  springOptions,
}: DockIconProps) {
  const ref = useRef<HTMLButtonElement | HTMLAnchorElement>(null)

  const distanceCalc = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - bounds.x - bounds.width / 2
  })

  const scaleSync = useTransform(distanceCalc, [-distance, 0, distance], [1, magnification, 1])
  const scale = useSpring(scaleSync, springOptions)

  const [isItemHovered, setIsItemHovered] = useState(false)

  const content = (
    <>
      <div 
        className={cn(
          "flex items-center justify-center rounded-xl transition-colors duration-200 w-full h-full",
          item.isActive ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        {item.icon}
      </div>

      <AnimatePresence>
        {(alwaysShowLabels || isItemHovered) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-xl whitespace-nowrap pointer-events-none",
              item.isActive && "bg-primary text-primary-foreground font-bold"
            )}
          >
            {item.label}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )

  const commonProps = {
    ref: ref as any,
    onMouseEnter: () => setIsItemHovered(true),
    onMouseLeave: () => setIsItemHovered(false),
    className: cn(
      "relative flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl origin-bottom cursor-pointer",
      item.isActive && "-translate-y-2" // Pop-up effect for active item
    ),
    style: {
      width: isHovered ? scale.get() * iconSize : iconSize,
      height: isHovered ? scale.get() * iconSize : iconSize,
    },
    onClick: item.onClick,
  }

  // Handle Framer Motion's style objects efficiently without re-rendering issues
  const motionStyle = {
    width: scale,
    height: scale,
    ...commonProps.style
  }

  if (item.href) {
    return (
      <Link href={item.href} legacyBehavior passHref>
        <motion.a 
          {...commonProps} 
          style={motionStyle}
        >
          {content}
        </motion.a>
      </Link>
    )
  }

  return (
    <motion.button 
      {...commonProps} 
      style={motionStyle}
    >
      {content}
    </motion.button>
  )
}
