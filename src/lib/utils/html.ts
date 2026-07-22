const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
}

/** Decode WordPress-rendered HTML entities (&#8217;, &amp;, dst) tanpa DOM (Server Component). */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X"
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10)
      return Number.isNaN(code) ? match : String.fromCodePoint(code)
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** Strip tag HTML dari konten WordPress (title/excerpt), lalu decode entity-nya. */
export function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, "")).trim()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Description produk WooCommerce sering mengulang nama produk sebagai heading
 * di awal (mis. "<h2>Nama Produk</h2><p><strong>NAMA</strong></p>" atau
 * "<h1>NAMA</h1>"), padahal nama produk sudah tampil besar di atas halaman.
 * Dipotong HANYA kalau heading itu cocok persis dengan nama produk asli —
 * supaya tidak salah potong konten yang bukan pengulangan (banyak deskripsi
 * di toko ini formatnya tidak konsisten satu sama lain).
 */
export function stripRedundantProductNameHeading(description: string, productName: string): string {
  const escapedName = escapeRegExp(productName.trim())
  let result = description.trim()

  // Fragmen HTML rusak (tag penutup nyasar di awal) dari proses copy-paste.
  result = result.replace(/^(\s*<\/p>\s*)+/i, "")

  const patterns = [
    new RegExp(`^<h1>\\s*${escapedName}\\s*<\\/h1>`, "i"),
    new RegExp(`^<h2>\\s*Nama Produk\\s*<\\/h2>\\s*<p>\\s*<strong>\\s*${escapedName}\\s*<\\/strong>\\s*<\\/p>`, "i"),
  ]

  for (const pattern of patterns) {
    result = result.replace(pattern, "")
  }

  return result.trim()
}
