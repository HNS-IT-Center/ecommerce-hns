import crypto from "node:crypto"

import { env } from "@/config/env"
import { buangStokGriya, type HnsItem } from "@/lib/api/hns-data/client"
import { syncAccurateItems } from "@/lib/api/accurate/stock-sync"

/**
 * Penerima webhook Data Accurate (docs/13 §10).
 *
 * Setiap selesai sinkron, Data Accurate mengirim barang yang berubah (100 per
 * kiriman) ke sini dengan POST bertanda tangan. Isinya kondisi TERBARU barang,
 * jadi cukup diterapkan ulang lewat `syncAccurateItems` — mesin yang sama
 * dengan tombol "Sinkron Stok Sekarang".
 *
 * Jalur ini PUBLIK (di luar proxy `/admin`), jadi satu-satunya penjaganya
 * tanda tangan HMAC. Tanpa `HNS_WEBHOOK_SECRET` SEMUA kiriman ditolak: kiriman
 * yang tidak bisa diverifikasi tidak boleh menulis stok yang dilihat pelanggan.
 *
 * Harus membalas 2xx dalam 15 detik, kalau tidak Data Accurate menganggapnya
 * gagal dan mengulang (1 menit, 5 menit, …). 100 barang per kiriman jauh di
 * bawah batas itu. Kiriman ganda (balasan kami terlambat) diabaikan lewat
 * `deliveryId` yang unik di `accurate_sync_runs`.
 */
export async function POST(req: Request) {
  const secret = env.HNS_WEBHOOK_SECRET
  if (!secret) return new Response("webhook belum dikonfigurasi", { status: 401 })

  // Body MENTAH — tanda tangan dihitung atas teks persis yang dikirim, sebelum
  // di-parse. JSON.stringify ulang hasil parse tidak menjamin teks yang sama.
  const raw = await req.text()
  const ts = req.headers.get("x-hns-timestamp") ?? ""
  const sig = req.headers.get("x-hns-signature") ?? ""
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")

  // Lebih dari 5 menit dari jam server = kiriman lama yang diputar ulang.
  const fresh = Number.isFinite(Number(ts)) && Math.abs(Date.now() / 1000 - Number(ts)) < 300
  const valid =
    sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  if (!fresh || !valid) return new Response("invalid signature", { status: 401 })

  let payload: {
    event?: string
    deliveryId?: string
    lastSyncAt?: string | null
    items?: HnsItem[]
  }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response("invalid json", { status: 400 })
  }

  if (payload.event === "ping") return Response.json({ ok: true })
  if (payload.event !== "items.changed" || !Array.isArray(payload.items)) {
    // Event yang belum kami kenal dibalas 2xx: menolaknya hanya membuat Data
    // Accurate mengulang kiriman yang memang tidak akan pernah kami proses.
    return Response.json({ ok: true, ignored: payload.event ?? null })
  }

  try {
    // Stok Griya dibuang di sini juga — kiriman webhook tidak lewat
    // `fetchAllHnsItems`, dan isinya mengikuti izin gudang client yang sama.
    const hasil = await syncAccurateItems(payload.items.map(buangStokGriya), {
      trigger: "webhook",
      deliveryId: (payload.deliveryId ?? req.headers.get("x-hns-delivery") ?? "").slice(0, 64) || null,
      sourceSyncedAt: payload.lastSyncAt ?? null,
    })
    return Response.json(hasil)
  } catch (error) {
    console.error("[hns-webhook] gagal menerapkan kiriman:", error)
    // 500 → Data Accurate mengulang dari titik yang sama; tidak ada perubahan
    // yang hilang.
    return new Response("gagal memproses", { status: 500 })
  }
}
