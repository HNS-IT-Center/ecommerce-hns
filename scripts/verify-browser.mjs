/**
 * Verifikasi visual & lapisan di browser sungguhan.
 *
 * Dipakai pertama kali untuk membuktikan bug z-index dropdown KATEGORI di
 * /stores, dan sengaja ditinggalkan karena verifikasi berikutnya membutuhkan
 * alat yang sama — terutama pemeriksaan tampilan halaman lokasi toko di
 * 375/768/1440.
 *
 * KENAPA INI ADA
 * Membaca sumber saja pernah meleset dua kali pada bug yang sama: sekali
 * menyalahkan `.leaflet-container` yang ternyata `z-index: auto`, sekali lagi
 * mengira pane 200–700 ikut menimpa padahal hanya kontrol (800/1000) yang
 * beririsan. `document.elementFromPoint()` menjawab pertanyaan yang sebenarnya
 * — "elemen mana yang benar-benar di atas di titik ini?" — dan tidak bisa
 * dibantah oleh pembacaan CSS.
 *
 * PRASYARAT
 * `playwright-core` tidak ada di package.json karena hanya dipakai sesekali.
 * Pasang sementara saat dibutuhkan:
 *   npm i --no-save playwright-core
 * Skrip memakai Chrome yang sudah terpasang di sistem, jadi tidak perlu
 * mengunduh browser Playwright (~400 MB).
 *
 * PENTING — build harus bersih
 * `next build` yang dijalankan sementara `next start` lama masih hidup
 * meninggalkan .next campuran: HTML merujuk chunk yang sudah tidak ada, dan
 * halaman gagal hidrasi dengan 404/500 di konsol. Gejalanya menyesatkan —
 * elemen "tidak ketemu" padahal ada di HTML. Kalau itu terjadi:
 *   pkill -f "next start" ; rm -rf .next ; npm run build
 *
 * PEMAKAIAN
 *   npx next start -p 3106
 *   node scripts/verify-browser.mjs                 # semua pemeriksaan
 *   node scripts/verify-browser.mjs layers          # lapisan saja
 *   node scripts/verify-browser.mjs shots           # tangkapan layar saja
 *   BASE=http://localhost:3000 node scripts/verify-browser.mjs
 *
 * Keluar dengan kode 1 kalau ada pemeriksaan gagal, jadi bisa dipakai di CI.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3106";
const OUT = process.env.OUT ?? "scratch/shots";

/** Chrome/Edge bawaan Windows — dicoba berurutan. */
const KANDIDAT_BROWSER = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

/** Lebar yang mewakili: ponsel, tablet, laptop, desktop lebar. */
const LEBAR_RESPONSIF = [375, 768, 1440, 1920];

let gagal = 0;
const lapor = (lulus, pesan) => {
  if (!lulus) gagal++;
  console.log(`${lulus ? "  LULUS " : "  GAGAL "} ${pesan}`);
};

async function bukaBrowser() {
  for (const path of KANDIDAT_BROWSER) {
    try {
      return await chromium.launch({ executablePath: path, headless: true });
    } catch {
      /* coba kandidat berikutnya */
    }
  }
  throw new Error(
    `Tidak menemukan Chrome/Edge. Coba: CHROME_PATH="C:/path/ke/chrome.exe" node scripts/verify-browser.mjs`,
  );
}

/**
 * Membuka halaman sambil merekam galat konsol.
 *
 * Galat halaman dilaporkan terpisah karena chunk yang gagal dimuat membuat
 * setiap pemeriksaan lain ikut gagal dengan alasan yang salah — lebih baik
 * ketahuan penyebabnya sejak awal.
 */
async function bukaHalaman(browser, url, { width, height = 900 }) {
  const page = await browser.newPage({ viewport: { width, height } });
  const galat = [];
  page.on("pageerror", (e) => galat.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") galat.push(m.text());
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // Leaflet perlu waktu memasang tile & kontrol
  return { page, galat };
}

/** Buka dropdown KATEGORI dan kembalikan Positioner-nya (stacking context panel). */
async function bukaDropdownKategori(page) {
  await page
    .locator('[data-slot="navigation-menu-trigger"]')
    .filter({ hasText: /kategori/i })
    .first()
    .click();
  await page.waitForTimeout(900); // animasi popup 0.35s + margin
}

/**
 * PEMERIKSAAN 1 — dropdown KATEGORI tidak boleh tertimpa apa pun.
 *
 * Mengambil setiap elemen Leaflet yang beririsan dengan panel, lalu menanyakan
 * ke browser siapa yang paling atas di titik irisannya. Panel harus menang di
 * semua titik.
 */
async function periksaLapisanDropdown(browser) {
  console.log("\n[1] Dropdown KATEGORI vs lapisan peta (/stores)");
  for (const width of [1280, 1366, 1440, 1600, 1920]) {
    const { page, galat } = await bukaHalaman(browser, `${BASE}/stores`, { width });
    if (galat.length) {
      lapor(false, `${width}px — halaman punya galat: ${galat[0].slice(0, 80)}`);
      await page.close();
      continue;
    }
    await bukaDropdownKategori(page);

    const r = await page.evaluate(() => {
      const peta = document.querySelector(".leaflet-container");
      const panel = document
        .querySelector('[data-slot="navigation-menu-content"]')
        ?.closest("div.isolate.z-50");
      if (!panel) return { ok: false, why: "panel dropdown tak ketemu" };
      if (!peta) return { ok: false, why: "peta tak ketemu" };

      const pr = panel.getBoundingClientRect();
      const kandidat = [
        ...document.querySelectorAll(
          ".leaflet-top, .leaflet-bottom, .leaflet-control-zoom, .leaflet-control-attribution, .leaflet-pane, .leaflet-marker-pane",
        ),
      ];

      let irisan = 0;
      const kalah = [];
      for (const n of kandidat) {
        const b = n.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        const x1 = Math.max(pr.left, b.left), x2 = Math.min(pr.right, b.right);
        const y1 = Math.max(pr.top, b.top), y2 = Math.min(pr.bottom, b.bottom);
        if (x1 >= x2 || y1 >= y2) continue;
        irisan++;
        const atas = document.elementFromPoint((x1 + x2) / 2, (y1 + y2) / 2);
        if (!atas || !panel.contains(atas)) {
          kalah.push(`${n.className.toString().slice(0, 32)} -> ${atas?.tagName.toLowerCase() ?? "null"}`);
        }
      }
      return {
        ok: true,
        isolationPeta: getComputedStyle(peta).isolation,
        irisan,
        kalah,
      };
    });

    if (!r.ok) lapor(false, `${width}px — ${r.why}`);
    else
      lapor(
        r.kalah.length === 0 && r.isolationPeta === "isolate",
        `${String(width).padStart(4)}px | isolation=${r.isolationPeta} | irisan=${r.irisan} | panel kalah di ${r.kalah.length}` +
          (r.kalah.length ? `\n           ${r.kalah.slice(0, 3).join("\n           ")}` : ""),
      );
    await page.close();
  }
}

/**
 * PEMERIKSAAN 2 — isi peta tetap utuh.
 *
 * `isolation: isolate` tidak boleh mengubah urutan DI DALAM peta. Tile harus
 * termuat, marker & kontrol tetap di atasnya, dan tombol zoom masih bisa diklik
 * (bukan sekadar terlihat).
 */
async function periksaIsiPeta(browser) {
  console.log("\n[2] Isi peta tetap utuh setelah isolate");
  const { page } = await bukaHalaman(browser, `${BASE}/stores`, { width: 1440 });

  const r = await page.evaluate(() => {
    const zoom = document.querySelector(".leaflet-control-zoom-in");
    const zb = zoom?.getBoundingClientRect();
    const atasZoom = zb
      ? document.elementFromPoint(zb.left + zb.width / 2, zb.top + zb.height / 2)
      : null;
    return {
      tile: document.querySelectorAll(".leaflet-tile-loaded").length,
      marker: document.querySelectorAll(".leaflet-marker-icon").length,
      // Atribusi OpenStreetMap WAJIB tampil — syarat lisensi ODbL, bukan gaya.
      attribution: !!document.querySelector(".leaflet-control-attribution"),
      zoomTerjangkau: !!atasZoom?.closest(".leaflet-control-zoom"),
    };
  });

  let klikBerhasil = false;
  try {
    await page.locator(".leaflet-control-zoom-in").first().click({ timeout: 3000 });
    klikBerhasil = true;
  } catch {
    /* dilaporkan di bawah */
  }

  lapor(r.tile > 0, `tile termuat: ${r.tile}`);
  lapor(r.marker > 0, `marker tampil: ${r.marker}`);
  lapor(r.attribution, `atribusi OSM tampil: ${r.attribution}`);
  lapor(r.zoomTerjangkau, `kontrol zoom di atas tile: ${r.zoomTerjangkau}`);
  lapor(klikBerhasil, `kontrol zoom bisa diklik: ${klikBerhasil}`);
  await page.close();
}

/**
 * PEMERIKSAAN 3 — lapisan melayang lain tidak menimpa dropdown.
 *
 * Menyapu SEMUA elemen `fixed`/`sticky` ber-z-index di halaman, bukan daftar
 * yang ditulis tangan — supaya komponen melayang yang ditambahkan nanti ikut
 * ketahuan tanpa skrip ini perlu diperbarui.
 */
async function periksaLapisanMelayang(browser, jalur = "/stores") {
  console.log(`\n[3] Lapisan melayang lain vs dropdown (${jalur})`);
  const { page } = await bukaHalaman(browser, `${BASE}${jalur}`, { width: 1440 });
  await bukaDropdownKategori(page);

  const r = await page.evaluate(() => {
    const panel = document
      .querySelector('[data-slot="navigation-menu-content"]')
      ?.closest("div.isolate.z-50");
    if (!panel) return { ok: false };
    const pr = panel.getBoundingClientRect();

    const hasil = [];
    for (const n of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(n);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      if (cs.zIndex === "auto" || panel.contains(n)) continue;
      const b = n.getBoundingClientRect();
      if (!b.width || !b.height) continue;

      const x1 = Math.max(pr.left, b.left), x2 = Math.min(pr.right, b.right);
      const y1 = Math.max(pr.top, b.top), y2 = Math.min(pr.bottom, b.bottom);
      const beririsan = x1 < x2 && y1 < y2;
      let menang = null;
      if (beririsan) {
        const atas = document.elementFromPoint((x1 + x2) / 2, (y1 + y2) / 2);
        menang = atas ? (panel.contains(atas) ? "panel" : "lapisan lain") : "?";
      }
      hasil.push({
        cls: (n.className?.baseVal ?? n.className ?? "").toString().slice(0, 42),
        z: cs.zIndex,
        beririsan,
        menang,
      });
    }
    return { ok: true, hasil };
  });

  if (!r.ok) return lapor(false, "panel dropdown tak ketemu");
  for (const l of r.hasil) {
    if (!l.beririsan) console.log(`  (lewat) z-${l.z} ${l.cls} — tidak beririsan`);
    else lapor(l.menang === "panel", `z-${l.z} ${l.cls} — yang menang: ${l.menang}`);
  }
}

/**
 * PEMERIKSAAN 4 — tangkapan layar responsif.
 *
 * Bukan pemeriksaan lolos/gagal: ini bahan untuk dilihat manusia. Dipakai untuk
 * verifikasi visual halaman lokasi toko di 375/768/1440.
 */
async function ambilTangkapanLayar(browser, jalur = "/stores") {
  console.log(`\n[4] Tangkapan layar ${jalur}`);
  mkdirSync(OUT, { recursive: true });
  const nama = jalur.replace(/\//g, "_").replace(/^_/, "") || "home";

  for (const width of LEBAR_RESPONSIF) {
    const { page, galat } = await bukaHalaman(browser, `${BASE}${jalur}`, { width });
    const berkas = `${OUT}/${nama}-${width}.png`;
    await page.screenshot({ path: berkas, fullPage: true });
    console.log(`  ${String(width).padStart(4)}px -> ${berkas}${galat.length ? `  (galat: ${galat[0].slice(0, 60)})` : ""}`);
    await page.close();
  }
}

const perintah = process.argv[2] ?? "all";
const browser = await bukaBrowser();
try {
  if (perintah === "all" || perintah === "layers") {
    await periksaLapisanDropdown(browser);
    await periksaIsiPeta(browser);
    await periksaLapisanMelayang(browser);
  }
  if (perintah === "all" || perintah === "shots") {
    await ambilTangkapanLayar(browser, process.argv[3] ?? "/stores");
  }
} finally {
  await browser.close();
}

console.log(gagal === 0 ? "\n=== SEMUA LULUS ===" : `\n=== ADA ${gagal} KEGAGALAN ===`);
process.exit(gagal === 0 ? 0 : 1);
