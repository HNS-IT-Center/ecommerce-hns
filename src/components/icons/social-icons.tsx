import type { SVGProps } from "react"

/**
 * Lambang media sosial — Instagram & TikTok.
 *
 * Dibuat sendiri karena `lucide-react` (ikon baku project ini) TIDAK memuat
 * ikon merek: versi barunya membuang seluruhnya, dan `l.Instagram` memang
 * `undefined`. Jalurnya mengikuti Tabler Icons, sumber yang sama dengan
 * `whatsapp-icon.tsx`, supaya ketiganya sebaris di footer — tebal garis,
 * ukuran kotak, dan bentuk sudutnya seragam.
 *
 * SENGAJA komponen biasa tanpa `"use client"` dan tanpa animasi: dipakai di
 * footer, yang Server Component. Ikon WhatsApp beranimasi yang sudah ada tetap
 * dipakai apa adanya (`motion/react` toh sudah dimuat di tiap halaman lewat
 * tombol WhatsApp mengambang), jadi tidak ada beban tambahan dari sana.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function InstagramIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M16.5 7.5v.01" />
    </Svg>
  )
}

export function TiktokIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v4.5a6.5 6.5 0 1 1 -8 -6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917z" />
    </Svg>
  )
}
