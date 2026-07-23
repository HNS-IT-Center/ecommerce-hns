"use client"

import { useState } from "react"
import { stripRedundantProductNameHeading } from "@/lib/utils/html"

interface ProductTabsProps {
  name: string
  description: string
  shortDescription: string
  attributes: Array<{ name: string; options: string[] }>
}

export function ProductTabs({ name, description, shortDescription, attributes }: ProductTabsProps) {
  const hasSpecs = attributes.length > 0
  const [activeTab, setActiveTab] = useState<"desc" | "spec">("desc")
  const cleanedDescription = stripRedundantProductNameHeading(description, name)

  const tabs = [
    { id: "desc" as const, label: "Deskripsi" },
    ...(hasSpecs ? [{ id: "spec" as const, label: "Spesifikasi" }] : []),
  ]

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
  )

  // Banyak produk (±43% dari katalog) belum punya data spesifikasi di WooCommerce.
  // Daripada nampilin tab "Spesifikasi" yang isinya cuma "belum ada data", tab itu
  // disembunyikan total kalau memang kosong — deskripsi langsung tampil tanpa UI tab.
  if (!hasSpecs) {
    return <div className="mt-12">{descriptionContent}</div>
  }

  return (
    <div className="mt-12">
      {/* Tab Headers */}
      <div className="flex border-b border-border">
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

      {/* Tab Content */}
      <div className="py-6">
        {activeTab === "desc" && descriptionContent}

        {activeTab === "spec" && (
          <table className="w-full text-sm">
            <tbody>
              {attributes.map((attr, i) => (
                <tr
                  key={attr.name}
                  className={i % 2 === 0 ? "bg-muted/30" : ""}
                >
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
        )}
      </div>
    </div>
  )
}
