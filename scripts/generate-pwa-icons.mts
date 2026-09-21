/**
 * Generates the PWA icons in `public/icons/` from `public/images/hns-logo.png`.
 *
 * Run once whenever the logo changes:  node scripts/generate-pwa-icons.mts
 *
 * Only the red "HNS" mark is used, not the "#1 IT CENTER BATAM" tagline under
 * it: at 192px the tagline is unreadable, and on Android's maskable icon it
 * would be clipped by the circular/squircle mask.
 *
 * Every icon is flattened onto white. The source PNG is transparent, and iOS
 * renders transparent home-screen icons on BLACK — the red mark would sit on a
 * black tile that looks nothing like the brand.
 */
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const SOURCE = path.join("public", "images", "hns-logo.png")
const OUT_DIR = path.join("public", "icons")

// Bounding box of the red mark inside the 1024×1024 source, measured from the
// pixels (see the PR that introduced this script). Padded slightly so the
// anti-aliased edges are not cut off.
const MARK = { left: 211, top: 239, width: 602, height: 328 }

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

type IconSpec = {
  file: string
  size: number
  /** Width of the mark as a fraction of the icon size. */
  markRatio: number
}

const ICONS: IconSpec[] = [
  { file: "icon-192.png", size: 192, markRatio: 0.8 },
  { file: "icon-512.png", size: 512, markRatio: 0.8 },
  // Maskable: everything important must sit inside the central circle of
  // radius 40%. For this mark (aspect ≈ 1.84) that caps the width at ~70%.
  { file: "icon-maskable-512.png", size: 512, markRatio: 0.64 },
  { file: "apple-touch-icon.png", size: 180, markRatio: 0.76 },
]

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const mark = await sharp(SOURCE).extract(MARK).png().toBuffer()

  for (const icon of ICONS) {
    const markWidth = Math.round(icon.size * icon.markRatio)
    const resized = await sharp(mark).resize({ width: markWidth }).png().toBuffer()

    await sharp({
      create: { width: icon.size, height: icon.size, channels: 4, background: WHITE },
    })
      .composite([{ input: resized, gravity: "center" }])
      .flatten({ background: WHITE })
      .png()
      .toFile(path.join(OUT_DIR, icon.file))

    console.log(`✓ ${icon.file} (${icon.size}×${icon.size})`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
