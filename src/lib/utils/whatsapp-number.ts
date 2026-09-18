/**
 * `6282169703377` → `+62 821-6970-3377`. Nomor di env disimpan polos (dipakai
 * apa adanya oleh wa.me), jadi format bacanya dibuat di sini khusus untuk
 * dicetak: 3 digit awal, lalu blok 4-an, sisanya digabung di blok terakhir.
 */
export function formatWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return raw

  const local = digits.replace(/^62/, "").replace(/^0/, "")
  if (local.length < 6) return `+62 ${local}`

  const blocks = [local.slice(0, 3), local.slice(3, 7), local.slice(7)].filter(Boolean)
  return `+62 ${blocks.join("-")}`
}
