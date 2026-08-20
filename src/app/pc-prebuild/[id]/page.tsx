import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, PencilRuler, TriangleAlert } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PrebuildOrderButton } from "@/features/pc-prebuild/components/prebuild-order-button"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig } from "@/lib/pc-prebuild/config"
import { resolvePrebuildPresets } from "@/lib/pc-prebuild/resolve"
import { formatRupiah } from "@/lib/utils"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const config = await getPcPrebuildConfig()
  const preset = config.presets.find((p) => p.id === id)

  if (!preset) return { title: "Paket tidak ditemukan — HNS IT Center" }

  return {
    title: `${preset.name} — PC Prebuild HNS IT Center`,
    description:
      preset.summary || `Spesifikasi lengkap paket ${preset.name} dari HNS IT Center Batam.`,
  }
}

/**
 * Detail satu paket: spesifikasi lengkapnya, harga per komponen, dan dua jalan
 * keluar — pesan apa adanya, atau ubah dulu di PC Builder.
 *
 * Halaman kartu (`/pc-prebuild`) sengaja hanya menampilkan sebagian komponen;
 * di sinilah seluruhnya terlihat, sebelum pelanggan memutuskan.
 */
export default async function PrebuildDetailPage({ params }: Props) {
  const { id } = await params
  const config = await getPcPrebuildConfig()

  if (!config.enabled) redirect("/build-pc")

  const preset = config.presets.find((p) => p.id === id)
  if (!preset) notFound()

  const steps = await getPcBuilderConfig()
  const [resolved] = await resolvePrebuildPresets([preset], steps)
  const tersedia = resolved.items.filter((item) => item.product !== null)

  // Hanya komponen yang produknya masih ada yang boleh ikut dipesan. Harga
  // finalnya tetap dihitung ulang di server oleh `prepareBuildWhatsApp`.
  const orderItems = tersedia.map((item) => ({
    productId: item.product!.id,
    quantity: item.quantity,
    stepName: item.stepName || "Komponen",
  }))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
          <Link
            href="/pc-prebuild"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Semua paket
          </Link>

          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{resolved.name}</h1>
          {resolved.summary && (
            <p className="mt-2 max-w-2xl text-muted-foreground">{resolved.summary}</p>
          )}

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section>
              <h2 className="mb-3 text-lg font-bold">Spesifikasi</h2>

              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Bagian</th>
                      <th className="px-4 py-3 font-semibold">Komponen</th>
                      <th className="px-4 py-3 text-right font-semibold">Jml</th>
                      <th className="px-4 py-3 text-right font-semibold">Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.items.map((item, index) => (
                      <tr key={`${item.stepId}-${index}`} className="border-b last:border-b-0">
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {item.stepName || "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {item.product ? (
                            <>
                              <Link
                                href={`/product/${item.product.slug}`}
                                className="font-medium hover:underline"
                              >
                                {item.product.name}
                              </Link>
                              {item.product.stock <= 0 && (
                                <span className="mt-0.5 block text-xs font-semibold text-sale-red">
                                  Stok habis — bisa diganti di PC Builder
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-sale-red">
                              Komponen sudah tidak tersedia
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-top tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right align-top tabular-nums">
                          {item.product ? formatRupiah(item.product.price * item.quantity) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {resolved.missingCount > 0 && (
                <p className="mt-3 flex items-start gap-2 text-sm text-sale-red">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {resolved.missingCount} komponen sudah tidak tersedia dan belum ikut dihitung.
                  Kamu tetap bisa memesan sisanya, atau menggantinya lewat PC Builder.
                </p>
              )}
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total {resolved.missingCount > 0 ? "(sebagian)" : ""}
                  </p>
                  <p className="text-2xl font-extrabold text-sale-red">
                    {formatRupiah(resolved.total)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Harga dibaca dari katalog saat halaman ini dibuka.
                  </p>
                </div>

                <PrebuildOrderButton items={orderItems} />

                {/* Jalan kedua: yang ingin menukar satu-dua komponen tidak perlu
                    menyusun ulang dari nol — paketnya dimuat ke wizard apa
                    adanya, lalu tinggal diubah. */}
                <Link
                  href={`/build-pc?preset=${encodeURIComponent(resolved.id)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-green px-6 py-3 text-sm font-bold text-brand-green transition-colors hover:bg-brand-green/10"
                >
                  <PencilRuler className="h-4 w-4" />
                  Ubah di PC Builder
                </Link>

                <p className="text-center text-xs text-muted-foreground">
                  Semua komponen tetap bisa diganti sebelum pesanan dikonfirmasi.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
