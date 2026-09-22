import { NextResponse } from "next/server"

import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { getPermissionVersion } from "@/lib/api/admin-users"

/**
 * "Apakah hak akses saya masih sama seperti saat halaman ini dimuat?"
 *
 * Ditanyakan berkala oleh `PermissionWatcher` di layout panel. Jawabannya satu
 * string cap (lihat `getPermissionVersion`); klien cuma membandingkannya dengan
 * yang ia pegang.
 *
 * ROUTE HANDLER, bukan server action, dan itu keputusan sadar. Server action
 * berjalan di dalam mesin RSC: tiap panggilan berpotensi ikut merender ulang
 * pohon halaman yang sedang terbuka. Untuk sesuatu yang dipanggil tiap setengah
 * menit oleh setiap panel yang terbuka, ongkos itu jauh lebih besar daripada
 * pekerjaan sebenarnya — yang cuma satu query kunci primer.
 *
 * `requireAuth()` dipanggil DI DALAM handler ini, bukan diandalkan dari
 * `src/proxy.ts` yang hanya menjaga /admin dan /akun. Alamat ini ada di /api,
 * di luar jangkauannya — pola yang sama dipakai `/api/admin/version`.
 *
 * Capnya menyangkut akun yang sedang masuk SAJA. Tidak ada parameter userId:
 * dengan begitu tidak ada cara memakainya untuk mengintip kapan hak akses orang
 * lain berubah.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireAuth()
    const version = await getPermissionVersion(user.id)

    return NextResponse.json(
      { version },
      // Jawaban yang di-cache sama saja dengan tidak bertanya.
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error("Gagal membaca versi izin:", error)
    return NextResponse.json({ error: "Gagal membaca versi izin." }, { status: 500 })
  }
}
