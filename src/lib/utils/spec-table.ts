/**
 * Perakit tabel spesifikasi produk.
 *
 * AI hanya mengembalikan pasangan kunci/nilai; markup-nya dirakit di sini.
 * Dua alasan konkret, bukan sekadar kerapian:
 *
 * 1. Hemat. Menyuruh model mengarang tabel HTML lengkap dengan class Tailwind
 *    menghabiskan ~1.277 token untuk 15 baris spesifikasi; mengembalikan
 *    pasangan kunci/nilai untuk produk yang sama cuma ~484 token dan 3,4x lebih
 *    cepat. Yang mahal itu mengetik ulang `class="py-2 px-3 …"` di setiap sel.
 *
 * 2. Gaya tabel jadi milik kode, bukan milik data. Kalau kelasnya ikut
 *    tersimpan di kolom `description` tiap produk, mengubah tampilan tabel
 *    berarti menjalankan ulang AI ke seluruh katalog. Di sini cukup ubah satu
 *    berkas.
 */

export type SpecEntry = { k: string; v: string }

/** Batas wajar satu produk. Menjaga output tetap masuk akal kalau model kalap. */
const MAX_ROWS = 60

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/**
 * Teks hasil AI ikut masuk ke `description` yang dirender dengan
 * `dangerouslySetInnerHTML` di halaman produk. Nilai spesifikasi wajar
 * mengandung `<`, `>`, dan `&` (mis. "RAM 16GB <slot kosong 1>", "2.5" & 3.5"
 * bay"), dan tanpa escaping karakter itu memutus tabelnya — atau lebih buruk,
 * menyisipkan tag yang tidak diinginkan.
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

export function buildSpecTableHtml(specs: SpecEntry[]): string {
  const rows = specs
    .filter((spec) => spec.k?.trim() && spec.v?.trim())
    .slice(0, MAX_ROWS)
    .map(
      (spec) =>
        `    <tr class="border-b even:bg-muted/30 hover:bg-muted/50 transition-colors">\n` +
        `      <td class="py-2 px-3 font-semibold w-1/3">${escapeHtml(spec.k.trim())}</td>\n` +
        `      <td class="py-2 px-3 text-muted-foreground">${escapeHtml(spec.v.trim())}</td>\n` +
        `    </tr>`
    )
    .join("\n")

  return `<table class="w-full text-sm text-left">\n  <tbody>\n${rows}\n  </tbody>\n</table>`
}

/**
 * Ambil daftar spesifikasi dari balasan model.
 *
 * Balasannya sudah dibatasi `response_format: json_object`, tapi tetap divalidasi
 * di sini: format JSON yang valid tidak menjamin bentuk datanya sesuai harapan.
 */
export function parseSpecEntries(rawJson: string): SpecEntry[] {
  const parsed: unknown = JSON.parse(rawJson)
  if (typeof parsed !== "object" || parsed === null) return []

  const specs = (parsed as { specs?: unknown }).specs
  if (!Array.isArray(specs)) return []

  return specs.flatMap((entry): SpecEntry[] => {
    if (typeof entry !== "object" || entry === null) return []
    const { k, v } = entry as { k?: unknown; v?: unknown }
    if (typeof k !== "string" || typeof v !== "string") return []
    return [{ k, v }]
  })
}
