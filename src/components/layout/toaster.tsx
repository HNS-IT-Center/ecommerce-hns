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

export function Toaster() {
  const { toasts } = useToastManager()

  return (
    <ToastPortal>
      <ToastViewport>
        {toasts.map((toast) => (
          <ToastRoot key={toast.id} toast={toast}>
            <ToastContent>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <ToastTitle />
                <ToastDescription />
              </div>
              <ToastClose>&times;</ToastClose>
            </ToastContent>
          </ToastRoot>
        ))}
      </ToastViewport>
    </ToastPortal>
  )
}
