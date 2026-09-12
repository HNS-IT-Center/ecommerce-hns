"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
import { useBackToClose } from "@/hooks/use-back-to-close"

/**
 * Dipasang di akar, bukan di tiap pemanggil: dengan begitu SEMUA dialog —
 * quick view, pilih komponen PC, konfirmasi hapus — ikut tertutup oleh tombol
 * Back tanpa perlu diingat satu per satu saat dialog baru dibuat nanti.
 */
function Dialog({
  open,
  onOpenChange,
  actionsRef,
  ...props
}: DialogPrimitive.Root.Props) {
  // Dialog tak terkendali mengurus keadaan bukanya sendiri. Keadaan itu diikuti
  // di sini supaya kedua gaya pemakaian sama-sama tertangani — untuk dialog
  // terkendali, prop `open` yang menjadi sumber kebenaran dan state ini hanya
  // dipakai sebagai cadangan.
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isOpen = open !== undefined ? open : uncontrolledOpen

  const handleOpenChange: NonNullable<DialogPrimitive.Root.Props["onOpenChange"]> = (
    nextOpen,
    eventDetails
  ) => {
    setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen, eventDetails)
  }

  /**
   * Penutupan dijalankan lewat `actionsRef.close()` milik Base UI, bukan dengan
   * memanggil `onOpenChange` sendiri: memanggilnya langsung berarti harus
   * mengarang objek `eventDetails` yang tidak punya asal-usul, dan itu akan
   * berbohong kepada pemanggil tentang APA yang menutup dialognya. Aksi
   * imperatif ini memang disediakan persis untuk keperluan seperti ini, dan
   * bekerja sama benarnya untuk dialog terkendali maupun tidak.
   */
  const internalActionsRef = React.useRef<DialogPrimitive.Root.Actions | null>(null)
  const closeFromBackButton = React.useCallback(() => {
    internalActionsRef.current?.close()
  }, [])

  useBackToClose(isOpen, closeFromBackButton)

  // Callback ref: menyimpan ke ref internal DAN meneruskan ke milik pemanggil.
  // Tanpa penerusan itu, memasang ref sendiri akan diam-diam mematikan
  // `actionsRef` yang mungkin sudah dipakai di tempat lain.
  //
  // Base UI meneruskan prop ini ke `useImperativeHandle`, yang menerima callback
  // ref sama seperti objek ref — tipenya saja yang dipersempit ke RefObject.
  const setActionsRef = React.useCallback(
    (value: DialogPrimitive.Root.Actions | null) => {
      internalActionsRef.current = value
      if (actionsRef) actionsRef.current = value
    },
    [actionsRef]
  )

  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      open={open}
      onOpenChange={handleOpenChange}
      actionsRef={setActionsRef as unknown as typeof actionsRef}
      {...props}
    />
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
