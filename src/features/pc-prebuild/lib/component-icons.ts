import {
  CircuitBoard,
  Cpu,
  Fan,
  HardDrive,
  Keyboard,
  MemoryStick,
  Microchip,
  Monitor,
  Package,
  PcCase,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { PrebuildComponentRole } from "@/lib/pc-prebuild/component-roles"

/**
 * Ikon per PERAN komponen, bukan per nama langkah.
 *
 * Perannya ditebak `detectComponentRole()` — satu daftar kata kunci yang juga
 * dipakai tombol analisis di panel admin dan endpoint AI. Kalau berkas ini
 * mencocokkan namanya sendiri, "VGA" bisa dapat ikon kartu grafis di kartu
 * paket sementara analisisnya menganggapnya komponen lain, dan tidak ada yang
 * akan menyadarinya sampai ada yang membandingkan dua layar.
 *
 * Ikonnya sengaja BERBEDA-BEDA. Satu ikon seragam untuk semua baris bukan
 * informasi, cuma pengisi ruang (docs/11-pc-prebuild.md §6).
 *
 * `component-roles.ts` tidak mengimpor apa pun, jadi berkas ini aman dipakai
 * Client Component.
 */
export const COMPONENT_ROLE_ICONS: Record<PrebuildComponentRole, LucideIcon> = {
  cpu: Cpu,
  motherboard: CircuitBoard,
  ram: MemoryStick,
  storage: HardDrive,
  gpu: Microchip,
  psu: Zap,
  cooler: Fan,
  case: PcCase,
  monitor: Monitor,
  peripheral: Keyboard,
  other: Package,
}
