import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { DynamicBuilderView } from "@/features/builder/components/dynamic-builder-view"
import { HandoverToast } from "@/features/quotation/components/handover-toast"
import { fetchBuilderProductsByIds } from "@/features/builder/actions"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig } from "@/lib/pc-prebuild/config"
import { getCurrentCustomer } from "@/lib/auth/customer"
import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import { listQuotationSalesUsers } from "@/lib/api/admin-users"
import { getQuotationForRevision } from "@/lib/api/pc-build-quotes"
import { priceCartFromCatalog } from "@/lib/api/woocommerce/cart-pricing"
import type { RevisionLoad } from "@/features/builder/components/dynamic-builder-view"
import type { BuilderSelection } from "@/store/new-builder"

export const metadata = {
  title: "PC Builder Custom",
  description: "Rakit PC idaman Anda dengan mudah. Pilih komponen, cek estimasi harga, dan cetak hasilnya.",
}

/**
 * Rakit sendiri, atau berangkat dari paket PC Prebuild lewat `?preset=<id>`.
 *
 * Presetnya diselesaikan DI SERVER, bukan di klien: harga dan stok tiap
 * komponen harus datang dari katalog (CLAUDE.md §2.7), dan menyerahkannya ke
 * klien berarti membuka jalan bagi angka yang tidak bisa dipertanggungjawabkan.
 */
export default async function BuildPcPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; pick?: string; quotation?: string }>
}) {
  const [{ preset: presetId, pick, quotation: quotationCode }, stepsConfig, customer] =
    await Promise.all([
      searchParams,
      getPcBuilderConfig(),
      getCurrentCustomer(),
    ])

  /**
   * Peran penerbit quotation, dihitung di SERVER.
   *
   * Sengaja lewat `getCurrentUser()` (sesi admin), bukan `customer.isAdmin`:
   * yang menentukan izin adalah akun admin pemilik cookie panel, dan seseorang
   * bisa punya dua sesi sekaligus di peramban yang sama. Pengunjung biasa tidak
   * memicu satu kueri izin pun.
   */
  const staff = await getCurrentUser()
  let quotationMode: "anon" | "sales" | "cs" = "anon"
  let salesOptions: { id: string; displayName: string }[] = []

  if (staff) {
    const izin = await muatIzinUser(staff)
    if (bisaAkses(izin, "quotation-terbit", "edit")) {
      quotationMode = bisaAkses(izin, "quotation-sales", "edit") ? "sales" : "cs"
      // Daftar operan hanya dibutuhkan CS. Sales tidak bisa memindahkan
      // quotation ke sales lain, jadi memuatnya untuk mereka cuma kueri sia-sia.
      if (quotationMode === "cs") salesOptions = await listQuotationSalesUsers(staff.id)
    }
  }

  /**
   * Mode Revisi: `?quotation=HNSPC-…`.
   *
   * Diselesaikan DI SERVER, pola yang sama dengan `?preset=`. Yang dimuat bukan
   * harga katalog hari ini melainkan harga REVISI TERAKHIR — itulah angka yang
   * sudah dipegang pelanggan di kertas, dan mempertahankannya adalah inti dari
   * fitur ini. Harga katalog tetap dibaca, tapi hanya untuk MENANDAI selisihnya.
   *
   * Kepemilikan dan status diperiksa di `getQuotationForRevision`; kode yang
   * bukan milik pemakai, atau yang sudah ditandai terjual, pulang sebagai null
   * dan halaman terbuka seperti rakitan biasa.
   */
  let revisionLoad: RevisionLoad | null = null

  if (quotationCode && staff && quotationMode !== "anon") {
    const seed = await getQuotationForRevision(quotationCode, staff.id)
    if (seed) {
      /**
       * Ketersediaan dan harga katalog dibaca lewat `priceCartFromCatalog`,
       * BUKAN dari `fetchBuilderProductsByIds`.
       *
       * `fetchBuilderProductsByIds` tidak menyaring `status` dan tidak
       * memeriksa `saleEndDate` — ia memang dipakai untuk menampilkan pilihan,
       * bukan untuk memutuskan apa yang boleh dijual. Kalau ketersediaan
       * disimpulkan dari situ, komponen yang sudah ditarik staf dari etalase
       * tetap termuat ke panel, terlihat normal, lalu baru ditolak saat sales
       * menekan Simpan — tanpa keterangan yang mana.
       *
       * Fungsi yang sama inilah yang nanti dipakai `reviseQuotation` di server,
       * jadi yang dimuat ke panel dan yang diterima saat menyimpan mustahil
       * berbeda pendapat.
       */
      const [products, priced] = await Promise.all([
        fetchBuilderProductsByIds(seed.items.map((i) => i.productId)),
        priceCartFromCatalog(
          seed.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          "id"
        ),
      ])

      const byId = new Map(products.map((p) => [p.id, p]))
      const hargaKatalog = new Map(priced.lines.map((l) => [l.productId, l.unitPrice]))
      const stepAda = new Map(stepsConfig.map((s) => [s.name, s.id]))

      const selections: Record<string, BuilderSelection[]> = {}
      const hargaSnapshot: Record<number, number> = {}
      const perubahan: RevisionLoad["perubahanHarga"] = []
      const hilang: string[] = []

      for (const item of seed.items) {
        const product = byId.get(item.productId)
        const hargaSekarang = hargaKatalog.get(item.productId)

        /**
         * Komponen yang sudah tidak bisa dijual DILAPORKAN dengan namanya dan
         * TIDAK ikut dimuat. Membiarkannya di panel berarti menyodorkan barang
         * yang pasti membatalkan penyimpanan; membuangnya diam-diam berarti
         * sales menyimpan revisi yang kehilangan satu barang tanpa sadar.
         */
        if (!product || hargaSekarang === undefined) {
          hilang.push(product?.name ?? `Produk #${item.productId}`)
          continue
        }

        /**
         * Step dicocokkan lewat NAMA yang tersimpan di snapshot, karena itulah
         * satu-satunya jejak kategori yang dibawa quotation. Step yang sudah
         * dihapus dari konfigurasi builder jatuh ke step pertama — komponennya
         * tetap termuat, hanya kelompoknya bergeser.
         */
        const stepId = (item.stepName ? stepAda.get(item.stepName) : null) ?? stepsConfig[0]?.id
        if (!stepId) continue

        hargaSnapshot[product.id] = item.price
        if (hargaSekarang !== item.price) {
          perubahan.push({
            name: product.name,
            hargaLama: item.price,
            hargaBaru: hargaSekarang,
          })
        }

        selections[stepId] = [...(selections[stepId] ?? []), { product, quantity: item.quantity }]
      }

      if (Object.keys(selections).length > 0 || hilang.length > 0) {
        revisionLoad = {
          code: seed.code,
          revisiBerlaku: seed.revision,
          customerName: seed.customerName ?? "",
          customerPhone: seed.customerPhone ?? "",
          internalNote: seed.internalNote ?? "",
          selections,
          hargaSnapshot,
          perubahanHarga: perubahan,
          komponenHilang: hilang,
        }
      }
    }
  }

  let presetLoad: { name: string; selections: Record<string, BuilderSelection[]> } | null = null

  if (presetId) {
    const config = await getPcPrebuildConfig()
    const preset = config.enabled ? config.presets.find((p) => p.id === presetId) : undefined

    if (preset) {
      /**
       * Yang menentukan harga adalah VARIANNYA kalau ada, bukan induknya —
       * induk VARIABLE sering berharga nol. Karena baris varian juga sebuah
       * `Product`, ia diambil lewat pencarian id yang sama.
       */
      const idBerlaku = (ref: { productId: number; variationId?: number }) =>
        ref.variationId ?? ref.productId

      const products = await fetchBuilderProductsByIds(
        preset.slots.flatMap((slot) =>
          slot.items.flatMap((item) => [
            idBerlaku(item),
            ...item.alternatives.map(idBerlaku),
          ])
        )
      )
      const byId = new Map(products.map((product) => [product.id, product]))
      const stepAda = new Set(stepsConfig.map((step) => step.id))
      const selections: Record<string, BuilderSelection[]> = {}

      /**
       * `pick` membawa pilihan tukar sebagai `stepId:id`, BUKAN indeks.
       *
       * Indeks akan berkhianat diam-diam: begitu staff mengurutkan ulang atau
       * menghapus satu pilihan, setiap tautan yang sudah tersebar lewat
       * WhatsApp menunjuk produk lain. Pelanggan membuka tautan "RAM 32GB"
       * minggu depan dan mendapat 16GB — tanpa error, tanpa ada yang tahu.
       *
       * Satu langkah kini bisa berisi BEBERAPA barang (dua NVMe berbeda),
       * masing-masing dengan pilihan tukarnya sendiri. Karena itu yang disimpan
       * per langkah adalah HIMPUNAN id yang diminta, bukan satu id — dan
       * pencocokannya dilakukan per barang.
       *
       * `id` adalah id VARIAN kalau pilihannya bervarian (`idBerlaku`), bukan
       * `productId`. Sejak chip varian multi-select (16 Sep 2026) "SSD 1TB atau
       * 2TB" adalah dua pilihan dengan induk yang sama; mencocokkan lewat
       * induk selalu memuat varian pertama. Tautan lama yang membawa
       * `productId` induk tetap dibaca — lewat putaran kedua, dan karena
       * kandidat pertama adalah bawaan, ia jatuh ke varian bawaan.
       */
      const diminta = new Map<string, Set<number>>()
      for (const bagian of (pick ?? "").split(",")) {
        const [stepId, mentah] = bagian.split(":")
        const productId = Number(mentah)
        if (stepId && Number.isFinite(productId) && productId > 0) {
          const set = diminta.get(stepId) ?? new Set<number>()
          set.add(productId)
          diminta.set(stepId, set)
        }
      }

      for (const slot of preset.slots) {
        // Step yang sudah dihapus dari konfigurasi builder DILEWATI — bukan
        // menggagalkan pemuatan. Rakitan yang termuat sebagian masih berguna;
        // yang tidak berguna adalah halaman yang menolak terbuka karena satu
        // komponen berubah.
        if (!stepAda.has(slot.stepId)) continue

        const idStep = diminta.get(slot.stepId)

        for (const item of slot.items) {
          // Seluruh kandidat untuk SATU barang: dirinya sendiri lebih dulu
          // (itulah bawaannya), lalu pilihan tukarnya.
          const kandidat = [item, ...item.alternatives]

          // Yang diminta lewat URL dipakai HANYA kalau ia benar-benar salah satu
          // kandidat barang ini dan produknya masih ada. Kalau tidak, jatuh ke
          // bawaan — bukan dipaksakan masuk.
          const dariUrl = idStep
            ? (kandidat.find((k) => idStep.has(idBerlaku(k)) && byId.has(idBerlaku(k))) ??
              kandidat.find((k) => idStep.has(k.productId) && byId.has(idBerlaku(k))))
            : undefined

          // Bawaan = kandidat pertama yang produknya masih ada. Stok kosong
          // TIDAK memindahkan bawaan — pelanggan bisa menukarnya di wizard.
          const terpakai = dariUrl ?? kandidat.find((k) => byId.has(idBerlaku(k)))
          const product = terpakai ? byId.get(idBerlaku(terpakai)) : undefined
          if (!terpakai || !product) continue

          selections[slot.stepId] = [
            ...(selections[slot.stepId] ?? []),
            { product, quantity: terpakai.quantity },
          ]
        }
      }

      if (Object.keys(selections).length > 0) {
        presetLoad = { name: preset.name, selections }
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <div className="hidden md:block print:hidden">
        <Header />
      </div>
      <main className="flex-1 bg-muted/20 print:bg-white print:m-0 print:p-0">
        <div className="mx-auto px-4 py-8 md:px-6 md:py-12 print:max-w-none print:p-8">
          <DynamicBuilderView
            stepsConfig={stepsConfig}
            isLoggedIn={!!customer}
            presetLoad={presetLoad}
            quotationMode={quotationMode}
            salesOptions={salesOptions}
            revisionLoad={revisionLoad}
          />

          {/*
            Notifikasi operan dipasang di halaman yang memang DIPAKAI sales,
            bukan di root layout.

            Alasannya bukan kerapian: `src/app/layout.tsx` sengaja tidak
            menyentuh `cookies()` supaya halaman toko tetap bisa statis/ISR
            (lihat catatan di sana). Membaca sesi di sana demi satu komponen
            akan membuat SELURUH storefront dirender per permintaan.

            Akibat yang diterima: sales yang sedang menelusuri katalog biasa
            tidak melihat toast sampai ia membuka Rakit PC atau riwayat
            quotation-nya. Operannya tidak hilang — ia menunggu di sana.
          */}
          {quotationMode === "sales" && <HandoverToast />}
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
