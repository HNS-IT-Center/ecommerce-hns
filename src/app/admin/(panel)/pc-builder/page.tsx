import { getPcBuilderConfig, getPcBuilderOptions } from "./actions"
import { PcBuilderForm } from "./_components/pc-builder-form"

export default async function PcBuilderPage() {
  const [config, options] = await Promise.all([
    getPcBuilderConfig(),
    getPcBuilderOptions()
  ])

  // Ensure config is sorted by order
  const sortedConfig = (config || []).sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">PC Builder Configuration</h2>
      </div>
      <p className="text-muted-foreground max-w-2xl">
        Configure the steps, categories, and dependencies for the PC Builder wizard. 
        Changes here will directly affect the customer-facing PC Builder page.
      </p>

      <div className="mt-8">
        <PcBuilderForm 
          initialSteps={sortedConfig} 
          categories={options.categories} 
          attributes={options.attributes} 
        />
      </div>
    </div>
  )
}
