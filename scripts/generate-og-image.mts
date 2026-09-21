/**
 * Generates `public/og-image.png`, the link preview image used when
 * hnsitcenter.id is shared on WhatsApp, Facebook, or X.
 *
 * Run after changing the logo or the tagline:
 *   node scripts/generate-og-image.mts
 *
 * 1200×630 is the size those platforms crop to. Only the red "HNS" mark is
 * used, not the full logo: the logo already carries the words "#1 IT CENTER
 * BATAM", which collided with the caption underneath it. The mark is kept well
 * inside the frame because WhatsApp shows a square-ish crop of the middle.
 *
 * MARK matches scripts/generate-pwa-icons.mts — change both together.
 */
import sharp from "sharp"
import path from "node:path"

const SOURCE = path.join("public", "images", "hns-logo.png")
const OUT = path.join("public", "og-image.png")

const WIDTH = 1200
const HEIGHT = 630
const TAGLINE = "Toko Komputer, Laptop &amp; Aksesoris di Batam"
const MARK = { left: 211, top: 239, width: 602, height: 328 }
const MARK_WIDTH = 520

const caption = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <text x="${WIDTH / 2}" y="470" text-anchor="middle"
        font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="#0d2959">
    ${TAGLINE}
  </text>
  <text x="${WIDTH / 2}" y="530" text-anchor="middle"
        font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#5b6b85">
    Rakit PC · Service &amp; Upgrade · 2 cabang di Batam
  </text>
</svg>`)

const mark = await sharp(SOURCE).extract(MARK).resize({ width: MARK_WIDTH }).png().toBuffer()
const markHeight = Math.round((MARK.height / MARK.width) * MARK_WIDTH)

await sharp({
  create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([
    { input: mark, top: Math.round((430 - markHeight) / 2), left: Math.round((WIDTH - MARK_WIDTH) / 2) },
    { input: caption, top: 0, left: 0 },
  ])
  .flatten({ background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(OUT)

console.log(`✓ ${OUT} (${WIDTH}×${HEIGHT})`)
