"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"

import { cn } from "@/lib/utils"

const useToastManager = ToastPrimitive.useToastManager

function Toast({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed right-4 bottom-4 z-50 mx-auto w-[calc(100vw-2rem)] outline-none sm:right-6 sm:bottom-6 sm:w-[22rem]",
        className
      )}
      {...props}
    />
  )
}

function ToastRoot({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "absolute inset-x-0 bottom-0 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg transition-all duration-200 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0 data-limited:pointer-events-none data-limited:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn("flex items-start gap-3 p-4", className)}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function ToastClose({ className, ...props }: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Tutup notifikasi"
      className={cn(
        "ml-auto shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Toast,
  ToastPortal,
  ToastViewport,
  ToastRoot,
  ToastContent,
  ToastTitle,
  ToastDescription,
  ToastClose,
  useToastManager,
}
