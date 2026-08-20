import Link from "next/link"
import { redirect } from "next/navigation"
import { Cpu, TriangleAlert } from "lucide-react"

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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {terisi.map((preset) => {
                const tampil = preset.items.filter((item) => item.product !== null)
                return (
                  <article
                    key={preset.id}
                    className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
                  >
                    <div>
                      <h2 className="text-lg font-bold">{preset.name}</h2>
                      {preset.summary && (
                        <p className="mt-1 text-sm text-muted-foreground">{preset.summary}</p>
                      )}
                    </div>

                    <ul className="space-y-1.5 text-sm">
                      {tampil.slice(0, MAX_SPEK_TAMPIL).map((item, index) => (
                        <li key={`${item.stepId}-${index}`} className="flex gap-2">
                          <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.product?.name}</span>
                            {item.product !== null && item.product.stock <= 0 && (
                              <span className="text-xs font-semibold text-sale-red">
                                Stok habis — bisa diganti di builder
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                      {tampil.length > MAX_SPEK_TAMPIL && (
                        <li className="pl-6 text-xs text-muted-foreground">
                          +{tampil.length - MAX_SPEK_TAMPIL} komponen lainnya
                        </li>
                      )}
                    </ul>

                    <div className="mt-auto space-y-3 border-t pt-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Total
                        </p>
                        <p className="text-xl font-extrabold text-sale-red">
                          {formatRupiah(preset.total)}
                        </p>
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
