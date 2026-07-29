"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPrisma } from "@/lib/prisma/client"

function readStoreInput(formData: FormData) {
  return {
    id: String(formData.get("id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    hours: String(formData.get("hours") ?? "").trim(),
    mapsUrl: String(formData.get("mapsUrl") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  }
}

function revalidateStorePages() {
  revalidatePath("/admin/toko")
  revalidatePath("/stores")
  revalidatePath("/contact")
}

export async function createStore(formData: FormData) {
  const input = readStoreInput(formData)
  const prisma = getPrisma()
  await prisma.store.create({ data: input })
  revalidateStorePages()
  redirect("/admin/toko")
}

export async function updateStore(formData: FormData) {
  const { id, ...data } = readStoreInput(formData)
  const prisma = getPrisma()
  await prisma.store.update({
    where: { id },
    data,
  })
  revalidateStorePages()
  redirect("/admin/toko")
}

export async function deleteStore(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  const prisma = getPrisma()
  await prisma.store.delete({ where: { id } })
  revalidateStorePages()
}
