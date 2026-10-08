/**
 * Membaca balasan endpoint internal yang SEHARUSNYA JSON, tanpa ikut tumbang
 * saat balasannya bukan JSON.
 *
 * Route handler kita selalu membalas JSON, termasuk saat gagal. Tapi tidak
 * semua balasan berasal dari route handler: proxy Hostinger menolak body yang
 * kebesaran dengan halaman HTML 413 sebelum permintaannya sampai ke Next, dan
 * saat server restart ia membalas halaman 502/504. Memanggil `res.json()`
 * langsung pada balasan seperti itu menghasilkan
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` — pesan yang tidak
 * berarti apa-apa bagi staff, dan menyembunyikan status yang sebenarnya.
 *
 * Melempar `Error` berpesan bahasa Indonesia untuk setiap kegagalan, jadi
 * pemanggil cukup menampilkan `error.message`.
 */
export async function readJsonResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text()

  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(describeNonJsonResponse(res.status))
  }

  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : ""
    throw new Error(message || `${fallbackError} (${res.status})`)
  }

  return data as T
}

function describeNonJsonResponse(status: number): string {
  // Route handler kita tidak pernah membalas 403 berupa HTML. 403 non-JSON
  // berarti permintaannya diblokir firewall CDN Hostinger (`server: hcdn`)
  // sebelum sampai ke Next — kejadian nyata 2 Oktober 2026 saat unggah foto.
  if (status === 403) {
    return "Permintaan diblokir oleh firewall hosting (403). Coba foto lain atau simpan ulang beberapa saat lagi; kalau terus terjadi, hubungi developer."
  }
  if (status === 413) {
    return "Ukuran berkas terlalu besar untuk diterima server (413). Perkecil fotonya lalu coba lagi."
  }
  if (status === 502 || status === 503 || status === 504) {
    return `Server sedang tidak bisa dijangkau (${status}). Tunggu sebentar lalu coba lagi.`
  }
  return `Server membalas dengan respons yang tidak terduga (${status}). Coba lagi, atau hubungi developer kalau terus terjadi.`
}
