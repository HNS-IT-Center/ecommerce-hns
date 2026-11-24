import type { PcBuilderStepKind } from "@/lib/pc-builder/step-kind"

/** Label `kind` — dibaca Ticketing (docs/17 §20), tidak memengaruhi storefront. */
export const STEP_KIND_LABELS: Record<PcBuilderStepKind, string> = {
  component: "Komponen — dirakit",
  peripheral: "Perlengkapan — diserahkan, tidak dirakit",
  service: "Jasa — tidak dicentang",
}
