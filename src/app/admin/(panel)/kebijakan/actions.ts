"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPrisma } from "@/lib/prisma/client"
import { requirePermission, UnauthorizedError } from "@/lib/auth"
import {
  PolicyPageError,
  createPolicyPage,
  savePolicyPage,
  softDeleteFaqItem,
  softDeletePolicyPage,
  type PolicyPageInput,
} from "@/lib/api/policy"
import { slugify } from "@/lib/utils/slug"
import type { PolicyActionState } from "./state"

/**
 * Keempat alamat kebijakan tidak lagi disebut satu per satu di sini.
 *
 * Dulu daftarnya ditulis harfiah, dan itu diam-diam menjadi daftar kelima yang
 * harus diingat orang saat menambah kebijakan — halaman baru tersimpan, tapi
 * pengunjung tetap melihat versi lama sampai cache-nya kebetulan kedaluwarsa.
 * Bentuk `("/kebijakan/[slug]", "page")` menyegarkan SELURUH halaman di route
 * dinamis itu, berapa pun jumlahnya.
 */
function revalidatePolicyPages() {
  revalidatePath("/admin/kebijakan")
  revalidatePath("/faq")
  revalidatePath("/kebijakan")
  revalidatePath("/kebijakan/[slug]", "page")
  // Peta situs menyusun daftar kebijakannya dari database juga — tanpa baris
  // ini, halaman yang baru dibuat baru diumumkan setelah `revalidate = 3600`
  // di sana berlalu.
  revalidatePath("/sitemap.xml")
}

/**
 * Menjalankan satu operasi tulis dan menerjemahkan galat yang layak dibaca staff
 * menjadi pesan di formulir. Pola dan alasannya sama seperti `run()` di
 * `toko/actions.ts`.
 */
async function run(fn: () => Promise<void>): Promise<PolicyActionState | never> {
  try {
    await requirePermission("kebijakan", "edit")
    await fn()
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof PolicyPageError) {
      return { error: error.message }
    }
    throw error
  }

  revalidatePolicyPages()
  redirect("/admin/kebijakan")
}

function readPolicyInput(formData: FormData): PolicyPageInput {
  const slugDiketik = String(formData.get("slug") ?? "").trim()

  return {
    // Slug yang diketik tetap dilewatkan `slugify`: staff yang mengetik
    // "Kebijakan Garansi" di medan slug mendapat "kebijakan-garansi", bukan
    // penolakan atas sesuatu yang dari sisi mereka sudah benar.
    slug: slugify(slugDiketik || String(formData.get("title") ?? "")),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
  }
}

export async function createPolicyPageAction(
  _prev: PolicyActionState,
  formData: FormData,
): Promise<PolicyActionState> {
  return run(() => createPolicyPage(readPolicyInput(formData)))
}

export async function updatePolicyPage(
  _prev: PolicyActionState,
  formData: FormData,
): Promise<PolicyActionState> {
  /*
   * Slug diambil apa adanya dari medan tersembunyi, TIDAK diturunkan ulang dari
   * judul. Staff yang memperbaiki judul "Kebijakan Pengiriman" menjadi
   * "Kebijakan Pengiriman & Pengambilan" tidak sedang meminta alamat halamannya
   * berpindah — dan kalau ia berpindah, tautan yang sudah beredar mati tanpa
   * ada yang memberi tahu.
   */
  const input = { ...readPolicyInput(formData), slug: String(formData.get("slug") ?? "").trim() }
  return run(() => savePolicyPage(input))
}

/**
 * Menandai kebijakan terhapus, bukan melenyapkan barisnya.
 *
 * Identitas penghapus diambil dari `requirePermission()`, BUKAN dari formulir —
 * lihat catatan yang sama pada `deleteStore`. Kebijakan bawaan ditolak di
 * lapisan data (`softDeletePolicyPage`), bukan di sini, supaya penjaganya tetap
 * menyala walau tombolnya dipanggil dari tempat lain.
 */
export async function deletePolicyPage(formData: FormData) {
  const user = await requirePermission("kebijakan", "edit")
  const slug = String(formData.get("slug") ?? "")
  if (!slug) return

  await softDeletePolicyPage(slug, user.id)
  revalidatePolicyPages()
}

function readFaqInput(formData: FormData) {
  return {
    question: String(formData.get("question") ?? "").trim(),
    answer: String(formData.get("answer") ?? "").trim(),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  }
}

export async function createFaqItem(formData: FormData) {
  await requirePermission("kebijakan", "edit")
  const input = readFaqInput(formData)
  const prisma = getPrisma()
  await prisma.faqItem.create({ data: input })
  revalidatePolicyPages()
  redirect("/admin/kebijakan")
}

export async function updateFaqItem(formData: FormData) {
  await requirePermission("kebijakan", "edit")
  const id = String(formData.get("id") ?? "")
  const input = readFaqInput(formData)
  const prisma = getPrisma()
  await prisma.faqItem.update({ where: { id }, data: input })
  revalidatePolicyPages()
  redirect("/admin/kebijakan")
}

/**
 * Menandai FAQ terhapus, bukan melenyapkan barisnya. Identitas penghapus
 * diambil dari `requirePermission()`, bukan dari formulir — lihat catatan yang sama
 * pada `deleteStore`.
 */
export async function deleteFaqItem(formData: FormData) {
  const user = await requirePermission("kebijakan", "edit")
  const id = String(formData.get("id") ?? "")
  if (!id) return

  await softDeleteFaqItem(id, user.id)
  revalidatePolicyPages()
}
