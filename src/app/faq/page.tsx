import { PolicyPageLayout } from "@/components/layout/policy-page-layout"
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion"
import { getFaqItems } from "@/lib/api/policy"

export const metadata = {
  title: "FAQ — HNS IT Center",
  description: "Pertanyaan yang sering diajukan seputar belanja di HNS IT Center.",
}

export default async function FaqPage() {
  const faqItems = await getFaqItems()

  return (
    <PolicyPageLayout title="Pertanyaan yang Sering Diajukan (FAQ)" breadcrumbLabel="FAQ">
      <Accordion className="not-prose">
        {faqItems.map((item, index) => (
          <AccordionItem key={index} value={String(index)}>
            <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
            <AccordionPanel className="text-muted-foreground">{item.answer}</AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </PolicyPageLayout>
  )
}
