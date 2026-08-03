"use client"

import {
  ToastPortal,
  ToastViewport,
  ToastRoot,
  ToastContent,
  ToastTitle,
  ToastDescription,
  ToastClose,
  useToastManager,
} from "@/components/ui/toast"

import { usePathname } from "next/navigation"

export function Toaster() {
  const { toasts } = useToastManager()
  const pathname = usePathname()
  const isBuildPc = pathname?.startsWith("/build-pc")

  return (
    <ToastPortal>
      <ToastViewport className={isBuildPc ? "!top-[140px] !bottom-auto md:!top-auto md:!bottom-4" : ""}>
        {toasts.map((toast: any) => {
          const isSuccess = toast.variant === 'success';
          return (
          <ToastRoot 
            key={toast.id} 
            toast={toast}
            className={isSuccess ? "bg-green-600 text-white border-green-600 min-h-0" : ""}
          >
            <ToastContent className={isSuccess ? "p-3 py-2" : ""}>
              <div className="flex min-w-0 flex-1 flex-col gap-0">
                <ToastTitle className={isSuccess ? "text-white text-sm" : ""} />
                <ToastDescription className={isSuccess ? "text-white/90 text-xs" : ""} />
              </div>
              <ToastClose className={isSuccess ? "text-white/80 hover:text-white top-2 right-2" : ""}>&times;</ToastClose>
            </ToastContent>
          </ToastRoot>
        )})}
      </ToastViewport>
    </ToastPortal>
  )
}
