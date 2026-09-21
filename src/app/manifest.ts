import type { MetadataRoute } from "next"

/**
 * Web App Manifest — what makes the site installable (Android, desktop) and
 * what the installed app looks like. Served by Next at `/manifest.webmanifest`
 * and linked from every page automatically.
 *
 * `start_url` carries `?source=pwa` so launches from the home-screen icon can
 * be told apart from browser visits in analytics. `scope` stays `/`: `/admin`
 * is deliberately NOT excluded — staff who install the app still reach the
 * panel inside it instead of being bounced out to the browser.
 *
 * The icons come from `scripts/generate-pwa-icons.mts`; regenerate them there
 * rather than editing the PNGs by hand. Background is white to match the
 * icons, which are flattened onto white.
 *
 * See `docs/14-pwa.md`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HNS IT Center Batam",
    short_name: "HNS IT Center",
    description:
      "Belanja PC, laptop, komponen, dan aksesoris komputer di HNS IT Center Batam. Rakit PC, service, dan upgrade hardware.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "id",
    categories: ["shopping", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
