import Link from "next/link";
import Image from "next/image";
import { TriangleAlert, TrendingUp } from "lucide-react";

import { formatRupiah } from "@/lib/utils";
import type { ResolvedSavedBuild } from "@/lib/api/saved-pc-builds";

/** Sampai 3 thumbnail komponen ditumpuk, sisanya cukup dihitung. */
const MAX_THUMBNAILS = 3;

export function SavedBuildCard({ build }: { build: ResolvedSavedBuild }) {
  const thumbnails = build.items
    .map((item) => item.product?.image)
    .filter((src): src is string => !!src)
    .slice(0, MAX_THUMBNAILS);

  return (
    <Link
      href={`/profile/rakitan/${build.id}`}
      className="group block rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-1">
        {thumbnails.length > 0 ? (
          thumbnails.map((src, i) => (
            <div
              key={i}
              className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-background"
              style={{ marginLeft: i > 0 ? "-0.5rem" : 0, zIndex: MAX_THUMBNAILS - i }}
            >
              <Image src={src} alt="" width={56} height={56} className="h-full w-full object-cover" />
            </div>
          ))
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-lg border bg-muted" />
        )}
      </div>

      <h3 className="mt-3 line-clamp-1 font-bold text-foreground group-hover:text-brand-green">
        {build.name}
      </h3>

      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{build.itemCount} komponen</span>
        <span className="font-bold text-foreground">{formatRupiah(build.subtotal)}</span>
      </div>

      {build.hasUnavailableItems && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          Ada komponen yang sudah tidak tersedia
        </p>
      )}

      {build.hasPriceChanges && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-foreground">
          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          Harga berubah sejak disimpan
        </p>
      )}
    </Link>
  );
}
