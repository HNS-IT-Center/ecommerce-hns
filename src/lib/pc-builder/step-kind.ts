/**
 * Murni — tanpa Prisma, tanpa next/cache — supaya komponen klien admin
 * (`step-card.tsx`) bisa mengimpornya. `config.ts` mengekspor ulang isinya.
 */

/**
 * Jenis baris sebuah step — dibaca aplikasi Ticketing (docs/17 §20) untuk
 * memisahkan yang DIRAKIT dari yang hanya diserahkan:
 *   - "component"  — dipasang ke dalam PC (dicentang teknisi, ikut dirakit)
 *   - "peripheral" — perlengkapan seperti monitor & UPS (dicentang, tidak dirakit)
 *   - "service"    — jasa, mis. Jasa Rakit (tidak dicentang)
 *
 * Opsional: step yang belum diatur tidak punya `kind`, dan Ticketing menebak
 * sendiri dari nama step. Tidak memengaruhi apa pun di storefront.
 */
export const PC_BUILDER_STEP_KINDS = ["component", "peripheral", "service"] as const
export type PcBuilderStepKind = (typeof PC_BUILDER_STEP_KINDS)[number]

export function isPcBuilderStepKind(value: unknown): value is PcBuilderStepKind {
  return typeof value === "string" && (PC_BUILDER_STEP_KINDS as readonly string[]).includes(value)
}
