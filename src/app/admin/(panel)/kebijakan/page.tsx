import Link from "next/link"
import { Plus } from "lucide-react"
import { isDatabaseConfigured } from "@/lib/prisma/client"
import { getAdminFaqItems, getAdminPolicyPages } from "@/lib/api/policy"
import { requirePageView } from "@/lib/auth"
import { FaqList } from "./faq-list"
import { PolicyList } from "./policy-list"

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

  /*
   * Keduanya lewat `lib/api/policy`, tanpa satu pun `getPrisma()` di berkas ini.
   * Daftar kebijakan dulu disusun dari konstanta `POLICY_PAGES` dan hanya
   * ditimpa oleh isi database — akibatnya halaman yang dibuat staff sendiri
   * tidak akan pernah muncul di sini, karena slug-nya tidak ada di konstanta.
   */
  const [policyPages, faqItems] = await Promise.all([getAdminPolicyPages(), getAdminFaqItems()])

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Halaman Kebijakan</h1>
          <Link
            href="/admin/kebijakan/baru"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tambah Kebijakan
          </Link>
        </div>
        <div className="mt-4">
          <PolicyList
            items={policyPages.map((page) => ({
              slug: page.slug,
              title: page.title,
              description: page.description ?? "",
              isSystem: page.isSystem,
            }))}
          />
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
