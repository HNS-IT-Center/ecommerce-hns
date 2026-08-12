import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { formatRupiah } from "@/lib/utils";
import { getCurrentCustomer } from "@/lib/auth/customer";
import { getSavedBuild } from "@/lib/api/saved-pc-builds";
import { SavedBuildActions } from "@/features/account/components/saved-build-actions";

export const metadata = {
  title: "Detail Rakitan — HNS IT Center",
  robots: { index: false, follow: false },
};

/** `+` untuk kenaikan, tanpa tanda untuk penurunan (formatRupiah sudah pakai "-"). */
function formatDelta(delta: number): string {
  return delta > 0 ? `+${formatRupiah(delta)}` : formatRupiah(delta);
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const { id } = await params;
  const build = await getSavedBuild(id, customer.id);
  if (!build) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <Link
            href="/akun"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Akun
          </Link>

          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">{build.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{build.itemCount} komponen</p>
            </div>
            <SavedBuildActions buildId={build.id} hasPriceChanges={build.hasPriceChanges} />
          </div>

          {build.hasUnavailableItems && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Sebagian komponen di rakitan ini sudah tidak dijual dan tidak dihitung ke total.
            </div>
          )}

          {build.hasPriceChanges && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
              <p className="text-sm font-bold">Harga telah berubah sejak terakhir disimpan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Rincian per komponen ada di bawah. Tekan &quot;Perbarui Harga Acuan&quot; kalau Anda
                ingin menjadikan harga saat ini sebagai patokan baru.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {build.items.map((item, i) => (
              <div
                key={`${item.stepId}-${i}`}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {item.product?.image ? (
                    <Image
                      src={item.product.image}
                      alt={item.product.name}
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {item.stepName}
                  </div>
                  {item.product ? (
                    <>
                      <div className="truncate text-sm font-semibold">{item.product.name}</div>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-sale-red">
                          {formatRupiah(item.product.currentPrice * item.quantity)}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                        )}
                      </div>
                      {item.priceDelta !== null && item.priceDelta !== 0 && (
                        <p
                          className={`mt-0.5 text-xs font-semibold ${
                            item.priceDelta > 0 ? "text-warning-foreground" : "text-brand-green"
                          }`}
                        >
                          Saat disimpan: {formatRupiah(item.savedPrice)} ({formatDelta(item.priceDelta)}
                          /satuan)
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-sm font-semibold text-muted-foreground">
                      Sudah tidak tersedia
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-muted/30 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Total saat ini</span>
              <span className="text-xl font-black text-sale-red">{formatRupiah(build.subtotal)}</span>
            </div>
            {build.hasPriceChanges && (
              <div className="mt-1.5 flex items-center justify-between border-t border-border/50 pt-1.5">
                <span className="text-xs text-muted-foreground">Total saat disimpan</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {formatRupiah(build.savedSubtotal)}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
