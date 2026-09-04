"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPrisma } from "@/lib/prisma/client"
import { requirePermission } from "@/lib/auth"
import { softDeleteFaqItem } from "@/lib/api/policy"

function revalidatePolicyPages() {
  revalidatePath("/admin/kebijakan")
  revalidatePath("/faq")
  revalidatePath("/kebijakan/pengembalian-barang")
  revalidatePath("/kebijakan/pengembalian-dana")
  revalidatePath("/kebijakan/pembatalan-pesanan")
  revalidatePath("/kebijakan/pengiriman")
}

export async function updatePolicyPage(formData: FormData) {
  await requirePermission("kebijakan", "edit")
  const slug = String(formData.get("slug") ?? "")
  const title = String(formData.get("title") ?? "").trim()
  const content = String(formData.get("content") ?? "").trim()

  const prisma = getPrisma()
  await prisma.policyPage.upsert({
    where: { slug },
    create: { slug, title, content },
    update: { title, content },
  })

  revalidatePolicyPages()
  redirect("/admin/kebijakan")
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
