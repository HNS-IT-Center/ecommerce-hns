"use client";

import { useState } from "react";
import { stripHtml, stripRedundantProductNameHeading } from "@/lib/utils/html";

interface ProductTabsProps {
  name: string;
  description: string;
  shortDescription: string;
  attributes: Array<{ name: string; options: string[] }>;
}

export function ProductTabs({
  name,
  description,
  shortDescription,
  attributes,
}: ProductTabsProps) {
  const hasSpecs = attributes.length > 0;
  const cleanedDescription = stripRedundantProductNameHeading(
    description,
    name,
  );

  // Kekosongan dinilai dari teks yang benar-benar TERLIHAT, bukan dari panjang
  // stringnya. Sebagian deskripsi warisan WooCommerce berisi `<p>&nbsp;</p>`
  // atau tag kosong — panjangnya bukan nol, tapi layarnya tetap kosong.
  const hasDescription =
    stripHtml(shortDescription).length > 0 ||
    stripHtml(cleanedDescription).length > 0;

  const tabs = [
    ...(hasDescription ? [{ id: "desc" as const, label: "Deskripsi" }] : []),
    ...(hasSpecs ? [{ id: "spec" as const, label: "Spesifikasi" }] : []),
  ];

  // Tab pembuka mengikuti isi, bukan selalu "Deskripsi". Dari 2.762 produk
  // published yang punya halaman sendiri (VARIATION tidak termasuk — itu baris
  // varian, bukan halaman), 27 punya spesifikasi tapi deskripsinya kosong dan
  // dulu membuka pada area kosong sementara isinya bersembunyi di balik klik.
  // Jumlahnya kecil, tapi bentuk salahnya jelas dan penjagaannya nyaris gratis.
  const [activeTab, setActiveTab] = useState<"desc" | "spec">(
    hasDescription ? "desc" : "spec",
  );

  const descriptionContent = (
    <div className="prose prose-sm max-w-none">
      {/* Short description first */}
      {shortDescription && (
        <div
          className="mb-4 text-base leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: shortDescription }}
        />
      )}
      {/* Full description */}
      <div dangerouslySetInnerHTML={{ __html: cleanedDescription }} />
    </div>
  );

  const specContent = (
    <table className="w-full text-sm">
      <tbody>
        {attributes.map((attr, i) => (
          <tr key={attr.name} className={i % 2 === 0 ? "bg-muted/30" : ""}>
            <td className="px-4 py-3 font-semibold text-foreground w-1/3">
              {attr.name}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {attr.options.join(", ")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Tidak ada isi sama sekali (54 produk published). Sebelumnya tetap keluar
  // sebagai kotak kosong bermargin; sekarang tidak menyisakan jarak apa pun.
  if (tabs.length === 0) return null;

  // Satu bagian saja tidak butuh UI tab — deretan tab berisi satu tombol hanya
  // menyiratkan ada bagian lain yang bisa dibuka, padahal tidak ada. Aturan ini
  // dulu hanya berlaku saat spesifikasi kosong; sekarang berlaku dua arah,
  // karena deskripsi jauh lebih sering kosong daripada spesifikasi.
  // `mt-6` di mobile, bukan `mt-12`: di layar ponsel blok ini menyusul tepat
  // setelah QR, dan jarak 48px di sana terbaca seperti halaman yang sudah
  // habis — pembeli berhenti menggulir sebelum sampai ke deskripsi. Desktop
  // tetap 48px karena kolomnya memang lebih lega.
  if (tabs.length === 1) {
    return (
      <div className="mt-6 md:mt-12">
        {tabs[0].id === "desc" ? descriptionContent : specContent}
      </div>
    );
  }

  return (
    <div className="mt-6 md:mt-12">
      {/*
        Deretan tab menempel di bawah header selama pembeli masih membaca.
        `top-16` = tinggi header yang `fixed` (lihat header.tsx), supaya tab
        berhenti tepat di bawahnya, bukan tersembunyi di baliknya.

        Sticky-nya lepas dengan sendirinya begitu isi selesai dibaca: elemen
        sticky hanya menempel selama INDUKNYA masih melewati viewport, dan
        induk di sini adalah blok tabs yang tingginya persis setinggi
        header + area isi. Jadi saat area isi sudah tergulung habis, blok ini
        ikut keluar layar dan tab-nya naik pergi — tanpa satu pun listener
        scroll atau pengukuran manual.
      */}
      <div className="sticky top-16 z-20 flex border-b border-border bg-background">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-brand-green text-brand-green"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Isi mengalir apa adanya dan ikut gulungan halaman — tidak ada kotak
          scroll tersendiri. Deretan tab di atas tetap menempel selama blok ini
          masih terlihat, lalu ikut naik pergi saat isinya habis. */}
      <div className="py-6">
        {activeTab === "desc" && descriptionContent}
        {activeTab === "spec" && specContent}
      </div>
    </div>
  );
}
