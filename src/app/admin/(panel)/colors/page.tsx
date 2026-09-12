import { Metadata } from "next"

import { requirePageView } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Color Overview | Admin Panel",
}

export default async function ColorsPage() {
  await requirePageView("colors")
  return (
    <div className="flex flex-col gap-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Color Overview</h1>
        <p className="text-muted-foreground mt-2">
          This is a visual guide of the CSS variable color palette used in this project.
        </p>
      </div>

      {/* Primary Palette */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">Primary Blue</h2>
        <div className="flex flex-wrap gap-4">
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((weight) => (
            <div key={weight} className="flex flex-col items-center">
              <div 
                className="h-20 w-20 rounded-xl shadow-sm border border-slate-100"
                style={{ backgroundColor: `var(--primary-${weight})` }}
              />
              <span className="text-xs font-mono mt-2 text-slate-600">{weight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary Palette */}
      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-semibold border-b pb-2">Secondary Blue</h2>
        <div className="flex flex-wrap gap-4">
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((weight) => (
            <div key={weight} className="flex flex-col items-center">
              <div 
                className="h-20 w-20 rounded-xl shadow-sm border border-slate-100"
                style={{ backgroundColor: `var(--secondary-${weight})` }}
              />
              <span className="text-xs font-mono mt-2 text-slate-600">{weight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Accent Red Palette */}
      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-semibold border-b pb-2">Accent / Destructive Red</h2>
        <div className="flex flex-wrap gap-4">
          {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((weight) => (
            <div key={weight} className="flex flex-col items-center">
              <div 
                className="h-20 w-20 rounded-xl shadow-sm border border-slate-100"
                style={{ backgroundColor: `var(--accent-${weight})` }}
              />
              <span className="text-xs font-mono mt-2 text-slate-600">{weight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Background / Text Palette */}
      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-semibold border-b pb-2">Background & Text Base</h2>
        <div className="flex flex-wrap gap-4">
          {["background", "foreground", "card", "popover", "muted", "border"].map((variable) => (
            <div key={variable} className="flex flex-col items-center">
              <div 
                className="h-20 w-20 rounded-xl shadow-sm border border-slate-200"
                style={{ backgroundColor: `var(--${variable})` }}
              />
              <span className="text-xs font-mono mt-2 text-slate-600">{variable}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
