import type { CurrentCustomer } from "@/lib/auth/customer"

/**
 * Pembacaan status login DARI SISI KLIEN.
 *
 * Berkas ini sengaja TIDAK `server-only` dan tidak menyentuh Prisma: ia
 * dipanggil dari peramban. Yang dibaca tetap satu-satunya sumber yang sah,
 * yaitu server, lewat `/api/auth/me` — jadi tidak ada status login yang
 * disimpan atau ditebak di klien.
 *
 * Ditaruh di `lib/api/` dan bukan di dalam komponen mengikuti CLAUDE.md §2.5:
 * yang memanggil endpoint tetap satu lapisan tersendiri, supaya penanganan
 * error dan bentuk datanya tidak diulang di tiap pemakai.
 *
 * ## Kenapa lewat endpoint, bukan prop dari Server Component
 *
 * `getCurrentCustomer()` memanggil `cookies()`. Membacanya di Header atau root
 * layout — keduanya dirender di SETIAP halaman — akan menandai seluruh
 * storefront sebagai dynamic, termasuk /cart, /faq, dan halaman kebijakan yang
 * seharusnya bisa prerender. Root layout memang sedang memakai
 * `force-dynamic`, tapi baris itu bertanda sementara (lihat komentarnya di
 * `app/layout.tsx`): kalau suatu hari dicabut, status login yang dibaca di
 * server akan diam-diam menahan seluruh situs tetap dynamic, dan tidak ada
 * yang akan tahu sampai ada yang mengukur.
 */
export type SessionSnapshot = {
  customer: CurrentCustomer | null
}

/**
 * `cache: "no-store"` bukan kehati-hatian berlebihan: fungsi ini dipanggil
 * ulang justru pada saat-saat status login BARU SAJA berubah (habis keluar,
 * tab kembali dibuka, peran diubah admin lain). Jawaban dari cache peramban
 * pada momen itu adalah jawaban yang lama — persis yang sedang dicoba
 * diperbaiki.
 *
 * Kegagalan jaringan dilaporkan sebagai "tidak tahu" (`null`), BUKAN sebagai
 * "belum masuk". Perbedaannya penting: wifi toko yang putus sedetik tidak
 * boleh membuat header berkedip menjadi tombol "Masuk" bagi orang yang
 * sebenarnya masih login.
 */
export async function fetchSession(): Promise<SessionSnapshot | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" })
    if (!res.ok) return null
    const data = (await res.json()) as SessionSnapshot
    return { customer: data.customer ?? null }
  } catch {
    return null
  }
}
