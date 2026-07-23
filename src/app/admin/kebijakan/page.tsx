import Link from "next/link"
import { Pencil, Plus } from "lucide-react"
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma/client"
import { POLICY_PAGES } from "@/lib/constants/policy-content"
import { deleteFaqItem } from "./actions"

import type { PolicyPage, FaqItem } from "@prisma/client"

export default async function AdminKebijakanPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Database belum dikonfigurasi — isi <code>DATABASE_URL</code> di <code>.env.local</code> lalu
        jalankan <code>npx prisma migrate dev</code> dan <code>npx prisma db seed</code>.
      </div>
    )
  }

  const prisma = getPrisma()
  const [dbPages, faqItems] = await Promise.all([
    prisma.policyPage.findMany(),
    prisma.faqItem.findMany({ orderBy: { sortOrder: "asc" } }),
  ])
  const dbPageMap = new Map(dbPages.map((page: PolicyPage) => [page.slug, page]))

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section>
        <h1 className="text-2xl font-bold">Halaman Kebijakan</h1>
        <div className="mt-4 space-y-2">
          {POLICY_PAGES.map((fallback) => {
            const page = dbPageMap.get(fallback.slug)
            return (
              <div
                key={fallback.slug}
                className="flex items-center justify-between rounded-xl border border-border bg-background p-4"
              >
                <div>
                  <h2 className="font-bold">{page?.title ?? fallback.title}</h2>
                  <p className="text-xs text-muted-foreground">/kebijakan/{fallback.slug}</p>
                  {!page && (
                    <p className="mt-1 text-xs text-warning">
                      Belum ada di database — halaman publik masih pakai konten default.
                    </p>
                  )}
                </div>
                <Link
                  href={`/admin/kebijakan/${fallback.slug}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">FAQ</h1>
          <Link
            href="/admin/kebijakan/faq/baru"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tambah FAQ
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {faqItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada FAQ.</p>
          )}
          {faqItems.map((item: FaqItem) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4"
            >
              <div>
                <h3 className="font-semibold">{item.question}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.answer}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/kebijakan/faq/${item.id}`}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Edit FAQ"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <form action={deleteFaqItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Hapus
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
