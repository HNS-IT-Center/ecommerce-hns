import { PREBUILD_USE_CASES, type PrebuildUseCaseId } from "@/lib/pc-prebuild/performance"

/**
 * "Cocok untuk apa" — dua bentuk dari satu sumber label.
 *
 * Labelnya datang dari `PREBUILD_USE_CASES`, katalog TERTUTUP yang juga dipakai
 * AI saat menskor (docs/11-pc-prebuild.md §9). Kalau layar ini menuliskan
 * labelnya sendiri, dua paket sekelas bisa berbunyi "Gaming Kompetitif" dan
 * "Esports" — dan pelanggan berhenti bisa membandingkannya.
 *
 * Id yang tidak dikenal (data lama, atau hasil parser yang meleset) DILEWATI,
 * bukan ditampilkan apa adanya.
 */

type Skor = { id: PrebuildUseCaseId; score: number }

const LABELS = new Map(PREBUILD_USE_CASES.map((u) => [u.id, u]))

/** Ambang "cocok". Di bawah ini paketnya memang bukan untuk keperluan itu. */
const AMBANG_COCOK = 60

type SkorLengkap = Skor & { label: string; description: string }

function urut(useCases: Skor[]): SkorLengkap[] {
  return useCases
    .map((u): SkorLengkap | null => {
      const meta = LABELS.get(u.id)
      return meta ? { ...u, label: meta.label, description: meta.description } : null
    })
    .filter((u): u is SkorLengkap => u !== null)
    .sort((a, b) => b.score - a.score)
}

/**
 * Bentuk ringkas untuk kartu di `/pc-prebuild`: hanya yang benar-benar cocok,
 * paling banyak tiga. Kartu yang menampilkan tujuh keperluan sekaligus —
 * termasuk yang berskor 20 — tidak memberi tahu apa pun tentang paketnya.
 */
export function UseCaseChips({ useCases }: { useCases: Skor[] }) {
  const cocok = urut(useCases)
    .filter((u) => u.score >= AMBANG_COCOK)
    .slice(0, 3)

  if (cocok.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {cocok.map((u) => (
        <span
          key={u.id}
          className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-[11px] font-semibold text-brand-green"
        >
          {u.label}
          <span className="tabular-nums opacity-70">{u.score}</span>
        </span>
      ))}
    </div>
  )
}

/** Bentuk penuh untuk halaman detail: semua keperluan beserta skornya. */
export function UseCaseScores({ useCases }: { useCases: Skor[] }) {
  const daftar = urut(useCases)
  if (daftar.length === 0) return null

  return (
    <ul className="space-y-2.5">
      {daftar.map((u) => (
        <li key={u.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{u.label}</p>
            <p className="truncate text-xs text-muted-foreground">{u.description}</p>
          </div>
          <span
            className={`text-sm font-extrabold tabular-nums ${
              u.score >= AMBANG_COCOK ? "text-brand-green" : "text-muted-foreground"
            }`}
          >
            {u.score}
          </span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                u.score >= AMBANG_COCOK ? "bg-brand-green" : "bg-muted-foreground/40"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, u.score))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
