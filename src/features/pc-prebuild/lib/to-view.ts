import "server-only"

import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import {
  COMPONENT_ROLE_LABELS,
  detectComponentRole,
  type PrebuildComponentRole,
} from "@/lib/pc-prebuild/component-roles"
import type {
  PrebuildProduct,
  ResolvedPrebuildAlternative,
  ResolvedPrebuildItem,
  ResolvedPrebuildPreset,
} from "@/lib/pc-prebuild/resolve"

import type { PrebuildComponent, PrebuildOption, PrebuildView } from "./types"

/**
 * `ResolvedPrebuildPreset` → bentuk yang boleh diberikan ke halaman pelanggan.
 *
 * Dua hal yang dikerjakan di sini dan TIDAK boleh dipindah ke komponen:
 *
 * 1. Hanya `performancePublic` yang diteruskan. `performance` apa adanya berisi
 *    draf, hasil basi, dan `bottleneck` yang khusus admin
 *    (docs/11-pc-prebuild.md §9). Penyaringannya sudah di `resolve.ts`; di sini
 *    tinggal memastikan bidang yang lain tidak ikut terbawa.
 * 2. Pilihan yang produknya sudah hilang dari katalog dibuang dari daftar.
 *    Tombol pilihan yang menunjuk produk tidak ada hanya menghasilkan slot
 *    kosong di wizard — dan `/build-pc` memang sudah melewatinya saat memuat
 *    preset, jadi menampilkannya di sini berarti dua halaman bercerita beda.
 *    Barang yang SELURUH pilihannya hilang tidak disembunyikan, ia ditandai.
 */

/**
 * Empat komponen yang dipatok di atas, dalam urutan ini.
 *
 * Inilah yang dicari orang pertama kali saat menilai sebuah rakitan; sisanya
 * menyusul urutan langkah yang disusun staff di `/admin/pc-builder`. Paket yang
 * tidak punya salah satunya (mis. kantor ber-grafis terintegrasi) cuma
 * kehilangan barisnya — sisanya naik, bukan menyisakan lubang.
 */
const MAIN_ROLES: PrebuildComponentRole[] = ["cpu", "ram", "storage", "gpu"]

function toOption(
  ref: ResolvedPrebuildAlternative,
  product: PrebuildProduct
): PrebuildOption {
  return {
    productId: ref.productId,
    ...(ref.variationId ? { variationId: ref.variationId } : {}),
    quantity: ref.quantity,
    label: ref.label,
    // Nama induk untuk baris keranjang; label variannya berdiri sendiri supaya
    // keranjang bisa menampilkannya di baris kedua seperti produk biasa.
    name: product.parentName ?? product.name,
    variationLabel: product.variationLabel,
    image: product.image,
    price: product.price,
    inStock: product.stock > 0,
    available: true,
  }
}

function toComponent(item: ResolvedPrebuildItem, index: number): PrebuildComponent {
  const kandidat: ResolvedPrebuildAlternative[] = [item, ...item.alternatives]

  const options = kandidat
    .map((ref) => (ref.product ? toOption(ref, ref.product) : null))
    .filter((o): o is PrebuildOption => o !== null)

  // Nama langkah lebih dipercaya daripada nama produk: nama produk lazim memuat
  // kata milik komponen lain ("RAM 16GB untuk Motherboard B760").
  const role = detectComponentRole(item.stepName, options[0]?.name ?? item.label)

  return {
    key: `${item.stepId}#${index}`,
    stepId: item.stepId,
    stepName: item.stepName,
    role,
    roleLabel: COMPONENT_ROLE_LABELS[role],
    options,
    branching: options.length > 1,
    missing: options.length === 0,
  }
}

/**
 * Urutan tampil: empat komponen utama di depan, sisanya menurut urutan langkah.
 *
 * Yang sudah ditarik ke atas TIDAK muncul lagi di bawah — satu barang hanya
 * boleh punya satu tempat, kalau tidak pelanggan menghitungnya dua kali.
 */
function orderComponents(
  components: PrebuildComponent[],
  steps: PcBuilderStepConfig[]
): PrebuildComponent[] {
  const urutanStep = new Map(steps.map((step, i) => [step.id, i]))

  const menurutLangkah = [...components].sort((a, b) => {
    // Langkah yang sudah dihapus dari PC Builder tidak punya urutan lagi;
    // ditaruh di belakang alih-alih dibuang, supaya paketnya tetap terbaca utuh.
    const ua = urutanStep.get(a.stepId) ?? Number.MAX_SAFE_INTEGER
    const ub = urutanStep.get(b.stepId) ?? Number.MAX_SAFE_INTEGER
    return ua - ub
  })

  const utama: PrebuildComponent[] = []
  const sudahDipakai = new Set<string>()

  for (const role of MAIN_ROLES) {
    const cocok = menurutLangkah.find((c) => c.role === role && !sudahDipakai.has(c.key))
    if (!cocok) continue
    utama.push(cocok)
    sudahDipakai.add(cocok.key)
  }

  return [...utama, ...menurutLangkah.filter((c) => !sudahDipakai.has(c.key))]
}

export function toPrebuildView(
  preset: ResolvedPrebuildPreset,
  steps: PcBuilderStepConfig[]
): PrebuildView {
  const components = orderComponents(
    preset.items.map((item, index) => toComponent(item, index)),
    steps
  )

  return {
    id: preset.id,
    name: preset.name,
    summary: preset.summary,
    images: preset.images,
    cover: preset.images[0] ?? null,
    components,
    total: preset.total,
    minTotal: preset.minTotal,
    branchingCount: preset.branchingCount,
    missingCount: preset.missingCount,
    outOfStockCount: preset.outOfStockCount,
    performance: preset.performancePublic,
  }
}
