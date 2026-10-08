/**
 * Baca isi balasan `fetch` sebagai JSON, dengan pesan yang bisa dipahami staff
 * kalau isinya ternyata BUKAN JSON.
 *
 * Route `/api/admin/*` di project ini selalu membalas JSON, termasuk saat
 * gagal. Yang membalas HTML adalah lapisan DI DEPANNYA — halaman galat CDN
 * Hostinger (hcdn) saat server sedang restart/deploy atau kehabisan waktu.
 * `res.json()` biasa melempar `Unexpected token '<', "<!DOCTYPE "...`, dan
 * pesan itulah yang dulu sampai ke layar staff apa adanya (Oktober 2026, Quick
 * Edit RAM T-FORCE): tidak menjelaskan apa-apa dan tidak menyarankan apa pun.
 *
 * Gangguan seperti itu biasanya sesaat, jadi pesannya menyarankan coba lagi
 * dan menyertakan kode HTTP untuk dilaporkan kalau ternyata berulang.
 */
export async function readJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      `Server sedang tidak bisa dihubungi dengan benar (HTTP ${res.status}). Biasanya hanya sesaat — coba lagi dalam beberapa detik.`,
    )
  }
}
