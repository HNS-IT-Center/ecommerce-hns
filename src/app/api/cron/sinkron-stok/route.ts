import crypto from "node:crypto"

import { env } from "@/config/env"
import { syncAccurateStockFull, waktuSinkronTerakhir } from "@/lib/api/accurate/stock-sync"

/**
 * Sinkron stok terjadwal — dipanggil cron hPanel (docs/13 §10).
 *
 * Sampai 19 Oktober 2026 sinkron hanya berjalan kalau seseorang menekan tombol
 * "Sinkron Stok Sekarang", dan pada 17–19 Oktober tidak ada yang menekannya:
 * stok di web basi dua hari. Webhook Data Accurate (`/api/hns-webhook`) belum
 * bisa dipasang, dan kalaupun sudah, ia hanya mengirim perubahan — jalur ini
 * tetap berguna sebagai jaring pengaman.
 *
 * Mesinnya sama persis dengan tombol (`syncAccurateStockFull`), hanya jalurnya
 * dicatat sebagai "jadwal" supaya riwayat di Update Harga bisa membedakannya.
 *
 * Penjaga:
 *  - **Token `CRON_SECRET`** di header `Authorization: Bearer …`. Tanpa env
 *    itu SEMUA panggilan ditolak. Jalur ini publik (di luar proxy `/admin`).
 *  - **Jeda 5 menit** sejak sinkron terakhir, apa pun jalurnya. Satu sinkron
 *    menarik ±15 halaman API dan menulis ke database Hostinger yang dibatasi
 *    500 koneksi per jam; panggilan beruntun — cron yang terpasang dua kali,
 *    atau token yang bocor — tidak boleh menghabiskannya. Yang dilewati
 *    dibalas 200, bukan galat: tombol yang baru ditekan staff bukan kegagalan
 *    cron, dan cron yang menerima galat mengirim surel peringatan.
 *  - **Hanya POST.** GET bisa terpicu perayap atau pratinjau tautan.
 *
 * Kalau tokennya bocor, akibat terburuknya satu sinkron tambahan per lima
 * menit — tidak ada masukan dari pemanggil yang dipakai.
 */
const JEDA_MINIMUM_MS = 5 * 60 * 1000

function tokenSah(header: string | null, secret: string): boolean {
  const dikirim = Buffer.from(header ?? "")
  const diharapkan = Buffer.from(`Bearer ${secret}`)
  return dikirim.length === diharapkan.length && crypto.timingSafeEqual(dikirim, diharapkan)
}

export async function POST(req: Request) {
  const secret = env.CRON_SECRET
  if (!secret) return new Response("sinkron terjadwal belum dikonfigurasi", { status: 401 })
  if (!tokenSah(req.headers.get("authorization"), secret)) {
    return new Response("token tidak sah", { status: 401 })
  }

  const terakhir = await waktuSinkronTerakhir()
  if (terakhir && Date.now() - terakhir.getTime() < JEDA_MINIMUM_MS) {
    return Response.json({
      ok: true,
      dilewati: `Sinkron terakhir dimulai ${terakhir.toISOString()}, kurang dari 5 menit lalu.`,
    })
  }

  try {
    const hasil = await syncAccurateStockFull(null, "jadwal")
    return Response.json(hasil)
  } catch (error) {
    // Sudah tercatat sebagai baris riwayat bergalat oleh `syncAccurateStockFull`
    // atau `syncAccurateItems`; status 500 supaya cron ikut melaporkannya.
    console.error("[cron/sinkron-stok] gagal:", error)
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Sinkron stok gagal." },
      { status: 500 },
    )
  }
}
