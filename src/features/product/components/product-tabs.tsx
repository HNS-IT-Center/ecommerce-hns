"use client"

import { useState } from "react"

interface ProductTabsProps {
  description: string
  shortDescription: string
  attributes: Array<{ name: string; options: string[] }>
}

export function ProductTabs({ description, shortDescription, attributes }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<"desc" | "spec">("desc")

  const tabs = [
    { id: "desc" as const, label: "Deskripsi" },
    { id: "spec" as const, label: "Spesifikasi" },
  ]

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
        {activeTab === "desc" && (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {/* Short description first */}
            {shortDescription && (
              <div
                className="mb-4 text-base leading-relaxed text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: shortDescription }}
              />
            )}
            {/* Full description */}
            <div dangerouslySetInnerHTML={{ __html: description }} />
          </div>
        )}

        {activeTab === "spec" && (
          <div>
            {attributes.length > 0 ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada spesifikasi untuk produk ini.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
