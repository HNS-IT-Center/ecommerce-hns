"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPrisma } from "@/lib/prisma/client"

function revalidatePolicyPages() {
  revalidatePath("/admin/kebijakan")
  revalidatePath("/faq")
  revalidatePath("/kebijakan/pengembalian-barang")
  revalidatePath("/kebijakan/pengembalian-dana")
  revalidatePath("/kebijakan/pembatalan-pesanan")
  revalidatePath("/kebijakan/pengiriman")
}

export async function updatePolicyPage(formData: FormData) {
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
  const input = readFaqInput(formData)
  const prisma = getPrisma()
  await prisma.faqItem.create({ data: input })
  revalidatePolicyPages()
  redirect("/admin/kebijakan")
}

export async function updateFaqItem(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  const input = readFaqInput(formData)
  const prisma = getPrisma()
  await prisma.faqItem.update({ where: { id }, data: input })
  revalidatePolicyPages()
  redirect("/admin/kebijakan")
}

export async function deleteFaqItem(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  const prisma = getPrisma()
  await prisma.faqItem.delete({ where: { id } })
  revalidatePolicyPages()
}
