import Link from "next/link"
import { Package, Store, FileText } from "lucide-react"
import { isDatabaseConfigured } from "@/lib/prisma/client"

const CARDS = [
  {
    href: "/admin/produk",
    icon: Package,
    title: "Produk",
    description: "Tambah & edit produk WooCommerce — nama, harga, stok, kategori, atribut, gambar.",
  },
  {
    href: "/admin/toko",
    icon: Store,
    title: "Toko & Lokasi",
    description: "Alamat, jam operasional, nomor WA, dan link Google Maps per toko.",
  },
  {
    href: "/admin/kebijakan",
    icon: FileText,
    title: "Kebijakan & FAQ",
    description: "Konten 4 halaman kebijakan dan daftar pertanyaan yang sering diajukan.",
  },
]

export default function AdminDashboardPage() {
  const dbConfigured = isDatabaseConfigured()

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Dashboard Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kelola produk, toko, dan konten kebijakan/FAQ dari sini.
      </p>

      {!dbConfigured && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Database (MariaDB) belum dikonfigurasi — menu <strong>Toko & Lokasi</strong> dan{" "}
          <strong>Kebijakan & FAQ</strong> belum bisa dipakai sampai <code>DATABASE_URL</code> diisi
          di <code>.env.local</code> dan migrasi dijalankan.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary"
          >
            <card.icon className="h-6 w-6 text-brand-green" />
            <h2 className="mt-3 font-bold">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
