import { NextResponse } from "next/server"

import { listUnseenHandovers } from "@/lib/api/pc-build-quotes"
import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"

/**
 * Operan dari CS yang belum dibaca oleh sales yang sedang masuk.
 *
 * Dipanggil berkala oleh `HandoverToast`, jadi ia harus MURAH. Pengunjung tanpa
 * cookie sesi admin pulang dari `getCurrentUser()` tanpa menyentuh database
 * sama sekali, dan komponen pemanggilnya sendiri hanya dipasang untuk akun
 * berperan Sales — jadi dalam praktiknya endpoint ini cuma dipanggil oleh
 * beberapa orang di toko.
 *
 * `no-store`: jawabannya berubah begitu sales menutup toast, dan jawaban basi
 * di sini berarti notifikasi yang sudah ditutup muncul lagi.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ operan: [] }, { headers: { "Cache-Control": "no-store" } })
  }

  const izin = await muatIzinUser(user)
  if (!bisaAkses(izin, "quotation-sales", "edit")) {
    return NextResponse.json({ operan: [] }, { headers: { "Cache-Control": "no-store" } })
  }

  const operan = await listUnseenHandovers(user.id)
  return NextResponse.json({ operan }, { headers: { "Cache-Control": "no-store" } })
}
