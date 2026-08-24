import { ArrowRight, TrendingUp } from "lucide-react"

import type { PrebuildUpgrade, PrebuildUpgradePriority } from "@/lib/pc-prebuild/performance"

/**
 * Saran menaikkan komponen, diurut dari yang paling berdampak.
 *
 * Ditulis sebagai "dari → ke", bukan sekadar "upgrade RAM". Pelanggan yang
 * membaca "RAM" tidak tahu RAM yang sekarang berapa; yang membaca
 * "8 GB → 16 GB" langsung tahu apa yang berubah dan bisa menanyakannya ke CS
 * dengan kata-kata yang sama.
 *
 * TIDAK ADA HARGA di sini, dan itu bukan kelalaian: selisih harga upgrade cuma
 * sah kalau datang dari katalog untuk produk tertentu, sedangkan saran ini
 * bicara tentang kelas komponen ("16 GB dual channel"), bukan satu SKU. Angka
 * yang dikarang di sini persis jenis angka yang dilarang CLAUDE.md §2.7.
 */

const NADA_PRIORITAS: Record<PrebuildUpgradePriority, string> = {
  tinggi: "bg-sale-red/10 text-sale-red",
  sedang: "bg-(--chart-3)/10 text-(--chart-3)",
  rendah: "bg-muted text-muted-foreground",
}

export function UpgradeList({ upgrades }: { upgrades: PrebuildUpgrade[] }) {
  if (upgrades.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-bold">
        <TrendingUp className="h-4 w-4 text-primary" />
        Saran Upgrade
      </h3>

      <ul className="space-y-2">
        {upgrades.map((upgrade, i) => (
          <li key={`${upgrade.component}-${i}`} className="rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold">{upgrade.component}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${NADA_PRIORITAS[upgrade.priority]}`}
              >
                {upgrade.priority}
              </span>
            </div>

            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {upgrade.from && <span className="text-muted-foreground">{upgrade.from}</span>}
              {upgrade.from && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
              <span className="font-semibold text-primary">{upgrade.to}</span>
            </p>

            {upgrade.impact && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {upgrade.impact}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
