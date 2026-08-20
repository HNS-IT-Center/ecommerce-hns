import Link from "next/link"
import { redirect } from "next/navigation"
import Image from "next/image"
import { TriangleAlert } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig } from "@/lib/pc-prebuild/config"
import { resolvePrebuildPresets } from "@/lib/pc-prebuild/resolve"
import { formatRupiah } from "@/lib/utils"

export const metadata = {
  title: "PC Prebuild — HNS IT Center",
  description:
    "Paket PC rakitan yang sudah dipilihkan teknisi HNS. Bisa langsung dipesan, bisa juga diubah dulu sesuai kebutuhan.",
}

/** Komponen yang ditampilkan di kartu. Sisanya terlihat setelah rakitan dimuat ke builder. */
const MAX_SPEK_TAMPIL = 4

export default async function PcPrebuildPage() {
  const config = await getPcPrebuildConfig()

  // Sakelar mati = rute ini tidak ada bagi pelanggan. Dilempar ke builder,
  // bukan 404: orang yang sampai ke sini memang sedang mencari PC rakitan.
  // Datanya tetap utuh — mematikan bukan menghapus.
  if (!config.enabled) redirect("/build-pc")

  const steps = await getPcBuilderConfig()
  const presets = await resolvePrebuildPresets(config.presets, steps)
  const terisi = presets.filter((preset) => preset.items.length > 0)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="bg-brand-green py-12 text-center text-primary-foreground">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
            PC PREBUILD
          </h1>
          <p className="mx-auto mt-4 max-w-xl px-4 text-lg text-primary-foreground/80">
            Sudah dipilihkan teknisi HNS. Bisa langsung dipesan, bisa juga diubah dulu sesuai
            kebutuhanmu.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          {terisi.length === 0 ? (
            <p className="text-center text-muted-foreground">
              Belum ada paket yang tersedia. Sementara ini kamu bisa merakit sendiri lewat{" "}
              <Link href="/build-pc" className="font-semibold text-brand-green underline">
                PC Builder
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-6">
              {/* Flex, BUKAN grid tiga kolom. Dengan grid, satu paket sendirian
                  menggantung di kolom kiri dan halaman terlihat rusak — padahal
                  di awal memang baru ada satu atau dua paket. */}
              {terisi.map((preset) => {
                const tampil = preset.items.filter((item) => item.product !== null)
                return (
                  <article
                    key={preset.id}
                    className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Foto rakitan utuh memimpin kartu kalau ada. Foto komponen
                        di bawah tetap berguna, tapi yang membuat orang berhenti
                        menggulir adalah wujud PC-nya. */}
                    {preset.image && (
                      <Image
                        src={preset.image}
                        alt=""
                        width={640}
                        height={480}
                        className="aspect-[4/3] w-full rounded-xl border bg-white object-contain"
                      />
                    )}

                    <div>
                      <h2 className="text-lg font-bold">{preset.name}</h2>
                      {preset.summary && (
                        <p className="mt-1 text-sm text-muted-foreground">{preset.summary}</p>
                      )}
                    </div>

                    {/* Foto komponen, BUKAN ikon seragam. Ikon yang sama untuk
                        prosesor, RAM, dan casing tidak memberi tahu apa pun —
                        ia cuma mengisi ruang. Fotonya sudah kita punya. */}
                    <ul className="space-y-2 text-sm">
                      {tampil.slice(0, MAX_SPEK_TAMPIL).map((item, index) => (
                        <li key={`${item.stepId}-${index}`} className="flex items-center gap-2.5">
                          {item.product?.image ? (
                            <Image
                              src={item.product.image}
                              alt=""
                              width={36}
                              height={36}
                              className="h-9 w-9 shrink-0 rounded-md border bg-white object-contain"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="h-9 w-9 shrink-0 rounded-md border bg-muted/40"
                            />
                          )}
                          <span className="min-w-0">
                            {/* Dua baris, bukan satu yang terpotong di tengah kata.
                                "PROCESSOR AMD RYZEN 5 5600 3.5 G…" menyembunyikan
                                justru bagian yang membedakan satu paket dari
                                yang lain. */}
                            <span className="line-clamp-2 text-xs font-medium leading-snug">
                              {item.product?.name}
                            </span>
                            {item.product !== null && item.product.stock <= 0 && (
                              <span className="text-[11px] font-semibold text-sale-red">
                                Stok habis — bisa diganti di builder
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                      {tampil.length > MAX_SPEK_TAMPIL && (
                        <li className="pl-[2.875rem] text-xs text-muted-foreground">
                          +{tampil.length - MAX_SPEK_TAMPIL} komponen lainnya
                        </li>
                      )}
                    </ul>

                    <div className="mt-auto space-y-3 border-t pt-4">
                      <div>
                        {/* "Mulai dari" HANYA untuk paket yang punya pilihan.
                            Menyeragamkan semua kartu jadi "mulai dari" membuat
                            harga pasti terlihat seperti harga awal. */}
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {preset.branchingCount > 0 ? "Mulai dari" : "Total"}
                        </p>
                        <p className="text-xl font-extrabold text-sale-red">
                          {formatRupiah(
                            preset.branchingCount > 0 ? preset.minTotal : preset.total
                          )}
                        </p>
                        {preset.branchingCount > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {preset.branchingCount} komponen bisa dipilih
                          </p>
                        )}
                        {preset.missingCount > 0 && (
                          <p className="mt-1 flex items-start gap-1.5 text-xs text-sale-red">
                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {preset.missingCount} komponen sedang tidak tersedia dan belum terhitung.
                          </p>
                        )}
                      </div>

                      {/* Menuju halaman detail, bukan langsung ke wizard.
                          Spesifikasi lengkapnya dilihat dulu; yang sudah cocok
                          bisa memesan dari sana, yang ingin menukar komponen
                          baru masuk ke PC Builder. */}
                      <Link
                        href={`/pc-prebuild/${encodeURIComponent(preset.id)}`}
                        className="block rounded-xl bg-brand-green px-4 py-3 text-center text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Lihat detail paket
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
