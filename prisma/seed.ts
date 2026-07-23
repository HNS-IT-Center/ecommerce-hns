import { getPrisma } from "../src/lib/prisma/client"
import { POLICY_PAGES, FAQ_ITEMS } from "../src/lib/constants/policy-content"
import { STORES } from "../src/lib/constants/stores"

async function main() {
  const prisma = getPrisma()

  for (const page of POLICY_PAGES) {
    await prisma.policyPage.upsert({
      where: { slug: page.slug },
      create: page,
      update: { title: page.title, content: page.content },
    })
  }
  console.log(`Seeded ${POLICY_PAGES.length} policy pages.`)

  await prisma.faqItem.deleteMany()
  await prisma.faqItem.createMany({ data: FAQ_ITEMS })
  console.log(`Seeded ${FAQ_ITEMS.length} FAQ items.`)

  for (const [index, store] of STORES.entries()) {
    const data = { ...store, sortOrder: index }
    await prisma.store.upsert({
      where: { id: store.id },
      create: data,
      update: data,
    })
  }
  console.log(`Seeded ${STORES.length} stores.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    const prisma = getPrisma()
    await prisma.$disconnect()
  })
