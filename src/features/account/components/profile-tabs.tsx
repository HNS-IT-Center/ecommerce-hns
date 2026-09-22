import Link from "next/link"

/**
 * Bilah tab yang dipakai bersama `/profile/quotation` dan `/profile/rakitan`.
 *
 * Berupa TAUTAN, bukan state klien. Keduanya halaman server dengan datanya
 * sendiri; menjadikannya tab klien berarti memuat dua daftar sekaligus lalu
 * menyembunyikan salah satunya, dan alamatnya tidak bisa di-bookmark atau
 * dikirim ke rekan kerja.
 *
 * Hanya tampil untuk staff yang boleh menerbitkan quotation — pelanggan biasa
 * cuma punya satu daftar, dan satu tab bukan tab.
 */
export function ProfileTabs({ active }: { active: "quotation" | "rakitan" }) {
  const tabs = [
    { key: "quotation" as const, href: "/profile/quotation", label: "Quotation Pelanggan" },
    { key: "rakitan" as const, href: "/profile/rakitan", label: "Rakitan Tersimpan" },
  ]

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            active === tab.key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
