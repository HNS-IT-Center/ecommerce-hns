import { Metadata } from "next"

export const metadata: Metadata = {
  title: "PC Builder Configuration",
  description: "Manage PC Builder settings and parts.",
}

export default function PCBuilderPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">PC Builder Configuration</h2>
      </div>
      <div className="flex items-center justify-center rounded-md border border-dashed p-8 h-96">
        <p className="text-sm text-muted-foreground">
          PC Builder Configuration content goes here.
        </p>
      </div>
    </div>
  )
}
