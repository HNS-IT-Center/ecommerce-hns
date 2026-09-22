"use server"

import { markHandoverSeen } from "@/lib/api/pc-build-quotes"
import { getCurrentUser } from "@/lib/auth"

/**
 * Menandai satu operan dari CS sudah dibaca — dipanggil saat sales menutup
 * toast-nya.
 *
 * Tidak mengembalikan pesan error untuk ditampilkan: kalau gagal, toast-nya
 * akan muncul lagi pada polling berikutnya, dan itulah perilaku yang benar.
 * Memberi tahu sales bahwa "penandaan gagal" tidak menambah apa pun yang bisa
 * ia lakukan.
 */
export async function markHandoverSeenAction(code: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  return { ok: await markHandoverSeen(String(code ?? ""), user.id) }
}
