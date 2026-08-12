"use server"

import { redirect } from "next/navigation"
import { getCurrentCustomer } from "@/lib/auth/customer"
import { validateUsername, validatePhoneNumber } from "@/lib/auth/customer-password"
import { normalizeIdentifier } from "@/lib/auth/identity"
import { sanitizeNextPath } from "@/lib/auth/safe-redirect"
import { getPrisma } from "@/lib/prisma/client"
import { Prisma } from "@prisma/client"
import type { CompleteProfileState } from "./state"

/**
 * Isi username + nomor HP untuk akun yang belum punya keduanya — jalur
 * WAJIB bagi akun Google, yang tidak pernah mendapat keduanya dari OAuth
 * (lihat catatan di schema.prisma pada Customer.username, dan
 * api/auth/google/callback/route.ts yang mengarahkan ke sini).
 *
 * Tidak menerima customerId dari form — sengaja dibaca dari sesi supaya
 * tidak ada cara mengisi profil akun ORANG LAIN lewat form yang dimanipulasi.
 */
export async function completeProfileAction(
  _prev: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const customer = await getCurrentCustomer()
  if (!customer) redirect("/login")

  const username = String(formData.get("username") ?? "").trim()
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim()
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""))

  if (!username || !phoneNumber) {
    return { error: "Username dan nomor HP wajib diisi.", ok: false }
  }
  const usernameError = validateUsername(username)
  if (usernameError) {
    return { error: usernameError, ok: false }
  }
  const phoneError = validatePhoneNumber(phoneNumber)
  if (phoneError) {
    return { error: phoneError, ok: false }
  }

  const normalizedUsername = normalizeIdentifier(username)
  const prisma = getPrisma()

  const usernameTaken = await prisma.customer.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  })
  if (usernameTaken && usernameTaken.id !== customer.id) {
    return { error: "Username ini sudah dipakai. Coba yang lain.", ok: false }
  }

  try {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { username: normalizedUsername, phoneNumber },
    })
  } catch (error) {
    // Race condition: dua permintaan nyaris bersamaan lolos cek di atas —
    // constraint unik di database jadi penjaga terakhir, sama pola dengan
    // registerCustomer di lib/auth/customer-password.ts.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Username ini sudah dipakai. Coba yang lain.", ok: false }
    }
    throw error
  }

  redirect(nextPath)
}
