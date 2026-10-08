import "server-only"

import { listQuotationSalesUsers } from "@/lib/api/admin-users"
import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"

/**
 * `"anon"`    — bukan staff penerbit; tombol Print menerbitkan dokumen anonim.
 * `"sendiri"` — staff yang menerbitkan atas namanya sendiri.
 * `"oper"`    — staff yang wajib memilih Sales tujuan atau "Tidak oper".
 */
export type QuotationMode = "anon" | "sendiri" | "oper"

export type QuotationIssuer = {
  /** Sesi admin pemilik cookie panel, kalau ada. */
  staff: Awaited<ReturnType<typeof getCurrentUser>>
  mode: QuotationMode
  /** Hanya terisi untuk mode `"oper"`. */
  salesOptions: { id: string; displayName: string }[]
  /** Akun ini TUJUAN operan — dipakai memasang toast notifikasi operan. */
  adalahSales: boolean
}

/**
 * Peran penerbit quotation untuk halaman yang menawarkan penerbitan — `/build-pc`
 * dan `/pc-prebuild/<id>`. Dihitung di SERVER, satu tempat, supaya aturan
 * siapa boleh menerbitkan dan mengoper tidak punya dua versi.
 *
 * Sengaja lewat `getCurrentUser()` (sesi admin), bukan `customer.isAdmin`:
 * yang menentukan izin adalah akun admin pemilik cookie panel, dan seseorang
 * bisa punya dua sesi sekaligus di peramban yang sama. Pengunjung biasa tidak
 * memicu satu kueri izin pun.
 *
 * `adalahSales` dipisah dari `mode`: sejak mengoper punya izinnya sendiri
 * (`quotation-oper`), mode penerbitan tidak lagi menjawab "orang ini sales atau
 * bukan". Menumpang pada mode akan membuat toast operan muncul untuk CS dan
 * hilang untuk sales yang merangkap CS — dua-duanya salah orang.
 */
export async function getQuotationIssuer(): Promise<QuotationIssuer> {
  const staff = await getCurrentUser()
  if (!staff) return { staff, mode: "anon", salesOptions: [], adalahSales: false }

  const izin = await muatIzinUser(staff)
  const adalahSales = bisaAkses(izin, "quotation-sales", "edit")
  if (!bisaAkses(izin, "quotation-terbit", "edit")) {
    return { staff, mode: "anon", salesOptions: [], adalahSales }
  }

  // Yang menentukan izin `quotation-oper`, bukan "bukan sales" — dulu satu-
  // satunya cara boleh mengoper adalah TIDAK berperan sales, aturan yang tak
  // pernah terlihat di panel dan menutup rangkap tugas di toko kecil.
  const mode: QuotationMode = bisaAkses(izin, "quotation-oper", "edit") ? "oper" : "sendiri"
  // Daftar operan hanya dibutuhkan yang boleh mengoper.
  const salesOptions = mode === "oper" ? await listQuotationSalesUsers(staff.id) : []
  return { staff, mode, salesOptions, adalahSales }
}
