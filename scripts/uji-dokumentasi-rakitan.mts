/**
 * Uji lapisan data Dokumentasi Rakitan — docs/17 §21:
 *   src/lib/api/ticketing-builds.ts
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-dokumentasi-rakitan.mts
 *
 * Tanpa jaringan dan tanpa database: `fetch` diganti tiruan, jadi setiap
 * jawaban Ticketing (200/400/401/404/503/500/timeout/bukan JSON) bisa diuji.
 * Opsional `--langsung=<kode>` memanggil Ticketing lokal sungguhan
 * (HNS_TICKETING_URL + TICKETING_INTEGRATION_TOKEN dari .env.local).
 */
try {
  process.loadEnvFile(".env.local")
} catch {
  // CI
}

const langsung = process.argv.find((a) => a.startsWith("--langsung="))?.slice("--langsung=".length)

if (!langsung) {
  process.env.HNS_TICKETING_URL = "http://ticketing.uji/"
  process.env.TICKETING_INTEGRATION_TOKEN = "uji-token-dokumentasi-0123456789abcdef0123456789"
}

const { getBuildDocumentation, parseBuildDocumentation, groupBuildPhotos } = await import(
  "../src/lib/api/ticketing-builds.ts"
)

if (langsung) {
  const hasil = await getBuildDocumentation(langsung)
  console.log(JSON.stringify(hasil, null, 2))
  process.exit(0)
}

let lolos = 0
const gagal: string[] = []
function cek(nama: string, kondisi: boolean, detail = "") {
  if (kondisi) {
    lolos += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal.push(nama)
    console.log(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`)
  }
}

const KODE = "HNSPC-20261116-0171"
const contoh = {
  quoteCode: KODE,
  ticket: {
    code: "NGW-000400",
    status: "done",
    stage: "finished",
    stageLabel: "Selesai, belum diserahkan",
    store: "Nagoya Gateway",
    technician: "Budi",
    finishedAt: "2026-11-17T08:12:00.000Z",
  },
  photos: [
    { group: "first_build", title: "Rakitan jadi", fileName: "a.jpg", url: "https://files.uji/a.jpg" },
    { group: "first_build", title: "Rakitan jadi 2", fileName: "b.jpg", url: "https://files.uji/b.jpg" },
    { group: "work_proof", title: "Bukti selesai", fileName: null, url: "http://127.0.0.1:9000/c.jpg" },
    { group: "kelompok_baru", title: "Judul Baru", fileName: "d.jpg", url: "https://files.uji/d.jpg" },
    { group: "components", title: "Komponen", fileName: "e.jpg", url: "javascript:alert(1)" },
    { group: "components", title: "Tanpa url" },
  ],
}

type Panggilan = { url: string; init: RequestInit | undefined }
let terakhir: Panggilan | null = null
function tiru(jawab: () => Promise<Response>) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    terakhir = { url: String(input), init }
    return jawab()
  }) as typeof fetch
}
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }))

console.log("\n1. Parser murni")
{
  const doc = parseBuildDocumentation(contoh)
  cek("jawaban contoh sah", doc !== null)
  cek("4 foto sah, 2 dibuang (javascript: & tanpa url)", doc?.photos.length === 4 && doc?.skippedPhotos === 2, JSON.stringify(doc?.photos.map((p) => p.url)))
  cek("fileName null tetap sah", doc?.photos.some((p) => p.fileName === null) === true)
  cek("bentuk salah → null", parseBuildDocumentation({ quoteCode: KODE }) === null)
  cek("bukan objek → null", parseBuildDocumentation("teks") === null)
  cek("photos tidak ada → daftar kosong", parseBuildDocumentation({ ...contoh, photos: undefined })?.photos.length === 0)

  const groups = groupBuildPhotos(doc?.photos ?? [])
  cek("urutan kelompok dipertahankan", groups.map((g) => g.key).join(",") === "first_build,work_proof,kelompok_baru", groups.map((g) => g.key).join(","))
  cek("label kelompok dikenal", groups[0]?.label === "Rakitan jadi" && groups[1]?.label === "Bukti selesai")
  cek("kelompok baru pakai judul foto pertama", groups[2]?.label === "Judul Baru")
  cek("first_build berisi 2 foto", groups[0]?.photos.length === 2)
}

console.log("\n2. Panggilan ke Ticketing")
{
  tiru(() => json(200, contoh))
  const hasil = await getBuildDocumentation(KODE)
  cek("200 → ok", hasil.kind === "ok")
  const p = terakhir as Panggilan | null
  cek("URL benar (garis miring akhir dibuang)", p?.url === `http://ticketing.uji/api/integrations/ecommerce/pc-builds/${KODE}`, p?.url)
  const headers = new Headers(p?.init?.headers)
  cek("Authorization Bearer", headers.get("authorization") === `Bearer ${process.env.TICKETING_INTEGRATION_TOKEN}`)
  cek("cache no-store", p?.init?.cache === "no-store")
  cek("ada signal timeout", p?.init?.signal instanceof AbortSignal)
}
{
  tiru(() => json(200, { ...contoh, quoteCode: "HNSPC-20261116-0172" }))
  const hasil = await getBuildDocumentation(KODE)
  cek("quoteCode lain → unavailable", hasil.kind === "unavailable")
}
{
  tiru(() => json(200, { ...contoh, quoteCode: KODE.toLowerCase() }))
  cek("quoteCode beda huruf besar-kecil tetap ok", (await getBuildDocumentation(KODE)).kind === "ok")
}
for (const [status, harap] of [
  [404, "no-ticket"],
  [400, "invalid-code"],
  [401, "unavailable"],
  [503, "unavailable"],
  [500, "unavailable"],
] as const) {
  tiru(() => json(status, { error: "x" }))
  const hasil = await getBuildDocumentation(KODE)
  cek(`${status} → ${harap}`, hasil.kind === harap, hasil.kind)
}
{
  tiru(() => Promise.resolve(new Response("<html>", { status: 200 })))
  const hasil = await getBuildDocumentation(KODE)
  cek("200 bukan JSON → unavailable", hasil.kind === "unavailable" && hasil.reason === "bad-response")
}
{
  tiru(() => Promise.reject(new DOMException("timeout", "TimeoutError")))
  const hasil = await getBuildDocumentation(KODE)
  cek("timeout → unavailable/timeout", hasil.kind === "unavailable" && hasil.reason === "timeout")
}
{
  tiru(() => Promise.reject(new TypeError("fetch failed")))
  const hasil = await getBuildDocumentation(KODE)
  cek("gagal terhubung → unavailable/network", hasil.kind === "unavailable" && hasil.reason === "network")
}

console.log(`\nHasil: ${lolos}/${lolos + gagal.length} lolos`)
if (gagal.length > 0) process.exit(1)
