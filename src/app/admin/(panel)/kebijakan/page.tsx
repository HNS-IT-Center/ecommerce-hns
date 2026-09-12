import Link from "next/link"
import { Pencil, Plus } from "lucide-react"
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma/client"
import { POLICY_PAGES } from "@/lib/constants/policy-content"
import { getAdminFaqItems } from "@/lib/api/policy"
import { requirePageView } from "@/lib/auth"
import { FaqList } from "./faq-list"

import type { PolicyPage } from "@prisma/client"

export default async function AdminKebijakanPage() {
  await requirePageView("kebijakan")
  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Database belum dikonfigurasi — isi <code>DATABASE_URL</code> di <code>.env.local</code> lalu
        jalankan <code>npx prisma migrate deploy</code> dan <code>npx prisma db seed</code>.
      </div>
    )
  }

  // FAQ lewat `lib/api/policy` supaya saringan `deletedAt` hanya ada di satu
  // tempat. Halaman kebijakan masih dibaca langsung — ia tidak punya soft
  // delete, jadi tidak ada saringan yang bisa terlewat.
  const prisma = getPrisma()
  const [dbPages, faqItems] = await Promise.all([
    prisma.policyPage.findMany(),
    getAdminFaqItems(),
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
        <div className="mt-4">
          <FaqList items={faqItems} />
        </div>
      </section>
    </div>
  )
}
