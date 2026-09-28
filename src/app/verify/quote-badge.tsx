import type { ReactNode } from "react"

/**
 * Lencana status quotation — satu bentuk, tiga nada.
 *
 * Dipakai bersama grid `/verify` dan halaman detailnya supaya kasir membaca
 * bentuk yang sama di dua layar. Sebelumnya masing-masing halaman menggambar
 * lencananya sendiri: yang satu bulat kecil berhuruf kapital, yang satu pil
 * besar berwarna penuh, dan "TERJUAL" di kartu tidak terlihat seperti "TERJUAL"
 * di detail.
 */
export function QuoteBadge({
  tone,
  children,
}: {
  tone: "asli" | "terjual" | "dp" | "netral"
  children: ReactNode
}) {
  const nada = {
    asli: "border-brand-green/30 bg-brand-green/10 text-brand-green",
    terjual: "border-brand-green/40 bg-brand-green text-white",
    dp: "border-primary/30 bg-primary/10 text-primary",
    netral: "border-border bg-muted text-muted-foreground",
  }[tone]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold leading-5 ${nada}`}
    >
      {children}
    </span>
  )
}
