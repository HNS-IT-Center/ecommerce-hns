"use client";

import { useOpenStatus } from "@/hooks/use-open-status";
import { cn } from "@/lib/utils";
import type { StoreHours } from "@/lib/utils/opening-hours";

/**
 * Lencana "Buka sampai …" / "Tutup". Dipakai kartu cabang dan popup peta.
 *
 * Ditahan sampai hidrasi selesai (`useOpenStatus` mengembalikan null di server)
 * supaya tidak sempat menampilkan status keliru dari jam server.
 */
export function OpenStatusBadge({
  hours,
  className,
}: {
  hours: readonly StoreHours[];
  className?: string;
}) {
  const status = useOpenStatus(hours);
  if (!status) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        status.state === "open"
          ? "bg-brand-green/10 text-brand-green"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status.label}
    </span>
  );
}
