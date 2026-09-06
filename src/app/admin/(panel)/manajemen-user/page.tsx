import type { Metadata } from "next"
import Link from "next/link"

import { requirePageView } from "@/lib/auth"
import { bisaAkses, ADMIN_PAGES } from "@/lib/auth/permissions"
import { listRoles } from "@/lib/api/roles"
import { listAdminUsers } from "@/lib/api/admin-users"
import { listCustomers } from "@/lib/api/customers"
import { isDatabaseConfigured } from "@/lib/prisma/client"

import { ManajemenUserView } from "./view"
import { AdminRoleList } from "../akun/admin-role-list"
import { CustomerList } from "../pelanggan/customer-list"

export const metadata: Metadata = {
  title: "Manajemen User — Admin HNS IT Center",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>
}

const TABS = [
  { key: "peran", label: "Peran" },
  { key: "admin", label: "Admin" },
  { key: "pelanggan", label: "Pelanggan" },
] as const

export default async function ManajemenUserPage({ searchParams }: Props) {
  const { user, izin } = await requirePageView("manajemen-user")
  const bolehEdit = bisaAkses(izin, "manajemen-user", "edit")

  const { tab: tabRaw, q, page } = await searchParams
  const tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as (typeof TABS)[number]["key"]) : "peran"

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Manajemen User</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola peran &amp; izinnya, tetapkan peran ke admin, dan lihat akun pelanggan yang
          mendaftar.
        </p>
      </div>

      {/* Tab */}
      <div className="mt-6 flex items-center gap-2 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/manajemen-user?tab=${t.key}`}
            className={`px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {tab === "peran" && <TabPeran bolehEdit={bolehEdit} />}
        {tab === "admin" && <TabAdmin currentUserId={user.id} canManage={user.role === "owner"} />}
        {tab === "pelanggan" && <TabPelanggan q={q} page={page} canDelete={user.role === "owner"} />}
      </div>
    </div>
  )
}

async function TabPeran({ bolehEdit }: { bolehEdit: boolean }) {
  const roles = await listRoles()
  const pages = Object.entries(ADMIN_PAGES).map(([key, label]) => ({ key, label }))
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Buat peran dan atur apa yang boleh diakses tiap peran — per halaman, dengan tingkat{" "}
        <strong>lihat</strong>, <strong>edit</strong>, atau <strong>tak ada</strong>.
      </p>
      <ManajemenUserView roles={roles} pages={pages} bolehEdit={bolehEdit} />
    </>
  )
}

async function TabAdmin({ currentUserId, canManage }: { currentUserId: string; canManage: boolean }) {
  const [admins, roles] = await Promise.all([listAdminUsers(), listRoles()])
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Akun admin dan perannya. <strong>Owner/Staff</strong> mengatur hak dasar; <strong>Peran</strong>{" "}
        menentukan halaman mana yang boleh diakses.
      </p>
      <AdminRoleList
        admins={admins.map((a) => ({
          id: a.id,
          name: a.name,
          username: a.username,
          email: a.email,
          role: a.role,
          roleId: a.roleId,
        }))}
        currentUserId={currentUserId}
        roleOptions={roles.map((r) => ({ id: r.id, name: r.name }))}
        canManage={canManage}
      />
    </>
  )
}

async function TabPelanggan({
  q,
  page,
  canDelete,
}: {
  q?: string
  page?: string
  canDelete: boolean
}) {
  if (!isDatabaseConfigured()) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Database belum dikonfigurasi.
      </div>
    )
  }
  const query = q?.trim() ?? ""
  const halaman = Number(page ?? 1) || 1
  const { rows, total, pageCount } = await listCustomers({ query, page: halaman })

  // Peran tiap pelanggan (dari `users`, id sama) + daftar peran yang bisa
  // diberikan. Sejak Satu Login pelanggan adalah baris di `users`.
  const { getPrisma } = await import("@/lib/prisma/client")
  const ids = rows.map((r) => r.id)
  const [roleRows, roleOptions] = await Promise.all([
    ids.length
      ? getPrisma().user.findMany({
          where: { id: { in: ids } },
          select: { id: true, roleId: true, roleRef: { select: { name: true } } },
        })
      : Promise.resolve([]),
    listRoles(),
  ])
  const roleById = new Map(roleRows.map((r) => [r.id, { roleId: r.roleId, roleName: r.roleRef?.name ?? null }]))

  const linkHal = (h: number) => {
    const sp = new URLSearchParams({ tab: "pelanggan", ...(query && { q: query }), page: String(h) })
    return `/admin/manajemen-user?${sp.toString()}`
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {total} akun pelanggan terdaftar. Setiap pendaftar masuk sebagai pelanggan secara default.
      </p>
      <form method="GET" className="mb-4 flex gap-2">
        <input type="hidden" name="tab" value="pelanggan" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Cari email, nama, atau username"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Cari akun pelanggan"
        />
        <button type="submit" className="rounded-md border border-input px-4 py-2 text-sm font-medium">
          Cari
        </button>
      </form>
      <CustomerList
        customers={rows.map((c) => ({
          ...c,
          // Date tidak bisa menyeberang ke Client Component apa adanya.
          emailVerifiedAt: c.emailVerifiedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          roleId: roleById.get(c.id)?.roleId ?? null,
          roleName: roleById.get(c.id)?.roleName ?? null,
        }))}
        canDelete={canDelete}
        roleOptions={roleOptions.map((r) => ({ id: r.id, name: r.name }))}
        canManageRole={canDelete}
      />

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Halaman {halaman} dari {pageCount}
          </p>
          <div className="flex gap-2">
            {halaman > 1 && (
              <Link
                href={linkHal(halaman - 1)}
                className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                ← Sebelumnya
              </Link>
            )}
            {halaman < pageCount && (
              <Link
                href={linkHal(halaman + 1)}
                className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Berikutnya →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}
