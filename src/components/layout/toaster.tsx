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
  // Panel admin menaruh notifikasi di kiri atas: sudut kanan bawah di sana
  // ditempati tombol WhatsApp mengambang dan dock mobile, yang menutupi toast
  // tepat saat aksi AI selesai.
  const isAdmin = pathname?.startsWith("/admin")

  const viewportClassName = isAdmin
    ? "!top-4 !left-4 !right-auto !bottom-auto sm:!top-6 sm:!left-6 sm:!right-auto sm:!bottom-auto"
    : isBuildPc
      ? "!top-[140px] !bottom-auto md:!top-auto md:!bottom-4"
      : ""

  return (
    <ToastPortal>
      <ToastViewport className={viewportClassName}>
        {toasts.map((toast) => {
          // Varian dibawa lewat `data` (payload bebas milik base-ui), bukan
          // sebagai prop tingkat atas — base-ui tidak punya field `variant`,
          // jadi menaruhnya di sana dulu hanya bisa lolos typecheck dengan
          // `as any` di setiap pemanggil.
          const isSuccess = toast.data?.variant === "success"
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
