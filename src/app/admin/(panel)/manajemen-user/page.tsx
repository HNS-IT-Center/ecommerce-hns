import type { Metadata } from "next"
import Link from "next/link"

import { requirePageView } from "@/lib/auth"
import {
  bisaAkses,
  adalahIzinLuarPanel,
  ADMIN_PAGE_AUDIENCE,
  ADMIN_PAGE_DESCRIPTIONS,
  ADMIN_PAGE_LEVEL_MODE,
  ADMIN_PERMISSION_TREE,
  type PermissionNode,
} from "@/lib/auth/permissions"
import { listRoles } from "@/lib/api/roles"
import { listAdminUsers, listSalesUsersWithDisplayName } from "@/lib/api/admin-users"
import {
  CUSTOMER_PAGE_SIZE,
  isCustomerSortField,
  isSortDirection,
  listCustomers,
} from "@/lib/api/customers"
import { isDatabaseConfigured } from "@/lib/prisma/client"
import { AdminPagination } from "@/components/admin/admin-pagination"

import { ManajemenUserView, type IzinNode } from "./view"
import { SalesNames } from "./sales-names"
import { AdminRoleList } from "../akun/admin-role-list"
import { CustomerList } from "../pelanggan/customer-list"

export const metadata: Metadata = {
  title: "Manajemen User — Admin",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }>
}

const TABS = [
  { key: "peran", label: "Peran" },
  { key: "admin", label: "Admin" },
  { key: "pelanggan", label: "Pelanggan" },
] as const

export default async function ManajemenUserPage({ searchParams }: Props) {
  const { user, izin } = await requirePageView("manajemen-user")
  const bolehEdit = bisaAkses(izin, "manajemen-user", "edit")

  const { tab: tabRaw, q, page, sort, dir } = await searchParams
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
        {tab === "admin" && (
          <TabAdmin
            currentUserId={user.id}
            // Master ikut dihitung owner — kolom `role`-nya sering "pelanggan"
            // karena akunnya juga dipakai belanja, dan tanpa ini ia melihat
            // daftar admin tanpa satu pun tombol kelola. Penjaganya sendiri ada
            // di `requireOwner()`, yang kini juga menghormati master.
            canManage={user.role === "owner" || izin.isMaster}
            bolehEdit={bolehEdit}
          />
        )}
        {tab === "pelanggan" && (
          <TabPelanggan
            q={q}
            page={page}
            sort={sort}
            dir={dir}
            canDelete={bisaAkses(izin, "pelanggan", "edit")}
            canManageRole={bolehEdit}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Pohon izin diubah menjadi data biasa untuk komponen klien.
 *
 * `ADMIN_PERMISSION_TREE` hidup di `permissions.ts` yang `server-only`, jadi ia
 * tidak bisa diimpor editor peran. Keterangan, saran pekerjaan, mode tingkat,
 * dan penanda "di luar panel" semuanya ditempelkan DI SINI — supaya editor
 * tidak perlu tahu satu pun aturannya, cukup menampilkan apa yang diberikan.
 */
function keIzinNode(nodes: readonly PermissionNode[]): IzinNode[] {
  return nodes.map((n) => ({
    key: n.key ?? null,
    label: n.label,
    description: n.key ? ADMIN_PAGE_DESCRIPTIONS[n.key] : null,
    audience: n.key ? ADMIN_PAGE_AUDIENCE[n.key] : null,
    mode: n.key ? ADMIN_PAGE_LEVEL_MODE[n.key] : null,
    luarPanel: n.key ? adalahIzinLuarPanel(n.key) : false,
    children: n.children ? keIzinNode(n.children) : undefined,
  }))
}

async function TabPeran({ bolehEdit }: { bolehEdit: boolean }) {
  const roles = await listRoles()
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Buat peran dan atur apa yang boleh diakses tiap peran. Izin dikelompokkan mengikuti menu
        panel — mengatur induknya sekaligus mengatur seluruh isinya.
      </p>
      <ManajemenUserView roles={roles} tree={keIzinNode(ADMIN_PERMISSION_TREE)} bolehEdit={bolehEdit} />
    </>
  )
}

async function TabAdmin({
  currentUserId,
  canManage,
  bolehEdit,
}: {
  currentUserId: string
  canManage: boolean
  bolehEdit: boolean
}) {
  const [admins, roles, salesUsers] = await Promise.all([
    listAdminUsers(),
    listRoles(),
    listSalesUsersWithDisplayName(),
  ])
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
        showFilter
      />

      <div className="mt-10">
        <h2 className="text-lg font-bold">Nama Sales di Quotation</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Nama yang tercetak sebagai <strong>Sales</strong> di PDF quotation. Kosongkan untuk
          memakai nama akun. Mengubahnya <strong>tidak</strong> mengubah quotation yang sudah
          terbit — hanya yang terbit sesudahnya.
        </p>
        <SalesNames
          rows={salesUsers}
          bolehEdit={bolehEdit}
        />
      </div>
    </>
  )
}

async function TabPelanggan({
  q,
  page,
  sort,
  dir,
  canDelete,
  canManageRole,
}: {
  q?: string
  page?: string
  sort?: string
  dir?: string
  /** Boleh MENGHAPUS akun pelanggan — izin `pelanggan: edit`. */
  canDelete: boolean
  /** Boleh menempelkan peran ke akun — izin `manajemen-user: edit`. */
  canManageRole: boolean
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
  // Parameter urutan datang dari URL, jadi divalidasi sebelum menyentuh query —
  // nilai karangan jatuh ke urutan bawaan, bukan ke halaman error.
  const urut = isCustomerSortField(sort) ? sort : undefined
  const arah = isSortDirection(dir) ? dir : undefined

  // Peran tiap pelanggan kini ikut dibaca `listCustomers` (lihat CustomerRow) —
  // sebelumnya halaman ini memanggil `getPrisma()` sendiri, yang melanggar §2.5
  // sekaligus membuat pengurutan per peran tidak mungkin.
  const [{ rows, total, pageCount }, roleOptions] = await Promise.all([
    listCustomers({ query, page: halaman, sort: urut, dir: arah }),
    listRoles(),
  ])

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {total} akun pelanggan terdaftar. Setiap pendaftar masuk sebagai pelanggan secara default.
      </p>
      <form method="GET" className="mb-4 flex gap-2">
        <input type="hidden" name="tab" value="pelanggan" />
        {/* Urutan yang sedang dipilih ikut dibawa saat mencari. Tanpa ini,
            formulir GET menulis ulang seluruh query string dan pencarian
            diam-diam mengembalikan urutan ke bawaan. */}
        {urut && <input type="hidden" name="sort" value={urut} />}
        {arah && <input type="hidden" name="dir" value={arah} />}
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
        }))}
        canDelete={canDelete}
        roleOptions={roleOptions.map((r) => ({ id: r.id, name: r.name }))}
        canManageRole={canManageRole}
        sort={urut}
        dir={arah}
      />

      <AdminPagination
        page={halaman}
        pageCount={pageCount}
        total={total}
        pageSize={CUSTOMER_PAGE_SIZE}
        labelBaris="akun"
      />
    </>
  )
}
