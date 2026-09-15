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

  /**
   * Username yang SUDAH ada tidak bisa diganti lewat form ini.
   *
   * Akun admin selalu punya username (dipakai masuk ke panel), tapi umumnya
   * belum punya nomor HP — jadi admin juga mampir ke sini. Kalau isian
   * username dari form diterima begitu saja, halaman "lengkapi profil" diam-diam
   * mengganti nama masuk panel mereka. Form menampilkannya read-only; baris ini
   * yang benar-benar menjaganya, karena server action bisa dipanggil langsung.
   */
  const existingUsername = customer.username
  const username = existingUsername ?? String(formData.get("username") ?? "").trim()
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim()
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""))

  if (!username || !phoneNumber) {
    return { error: "Username dan nomor HP wajib diisi.", ok: false }
  }
  const phoneError = validatePhoneNumber(phoneNumber)
  if (phoneError) {
    return { error: phoneError, ok: false }
  }

  const prisma = getPrisma()

  if (existingUsername) {
    await prisma.user.update({ where: { id: customer.id }, data: { phoneNumber } })
    redirect(nextPath)
  }

  const usernameError = validateUsername(username)
  if (usernameError) {
    return { error: usernameError, ok: false }
  }

  const normalizedUsername = normalizeIdentifier(username)

  const usernameTaken = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true },
  })
  if (usernameTaken && usernameTaken.id !== customer.id) {
    return { error: "Username ini sudah dipakai. Coba yang lain.", ok: false }
  }

  try {
    await prisma.user.update({
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
