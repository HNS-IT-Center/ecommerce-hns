import Link from "next/link"

/**
 * Bilah tab yang dipakai bersama `/profile`, `/profile/quotation`, dan
 * `/profile/rakitan`.
 *
 * Berupa TAUTAN, bukan state klien. Keduanya halaman server dengan datanya
 * sendiri; menjadikannya tab klien berarti memuat dua daftar sekaligus lalu
 * menyembunyikan salah satunya, dan alamatnya tidak bisa di-bookmark atau
 * dikirim ke rekan kerja.
 *
 * Hanya tampil untuk staff yang boleh menerbitkan quotation — pelanggan biasa
 * cuma punya satu daftar, dan satu tab bukan tab.
 */
export function ProfileTabs({ active }: { active: "profil" | "quotation" | "rakitan" }) {
  /**
   * `/profile` ikut jadi TAB, bukan halaman induk yang memuat tab.
   *
   * Sebelumnya bilah ini duduk di antara kartu profil dan daftar rakitan, jadi
   * kartu profilnya terbaca seolah isi tab "Rakitan Tersimpan" — padahal ia
   * halaman tersendiri. Dengan "Profil Saya" jadi tab pertama, yang aktif
   * selalu menjelaskan apa yang sedang dilihat, dan tidak ada lagi isi halaman
   * yang menggantung di luar tab mana pun.
   */
  const tabs = [
    { key: "profil" as const, href: "/profile", label: "Profil Saya" },
    { key: "quotation" as const, href: "/profile/quotation", label: "Quotation Pelanggan" },
    { key: "rakitan" as const, href: "/profile/rakitan", label: "Rakitan Tersimpan" },
  ]

  // `-mx-4 px-4` di HP: bilahnya boleh menggulir sampai tepi layar, jadi tab
  // ketiga terlihat separuh — isyarat bahwa masih ada yang bisa digeser.
  // Tanpa itu tab terakhir terpotong rapi di tepi kartu dan tampak tidak ada.
  return (
    <div className="-mx-4 flex items-center gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
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
