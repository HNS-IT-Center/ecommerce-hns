import { redirect } from "next/navigation"

export default function CategoryRedirectPage({ params }: { params: { slug: string } }) {
  redirect(`/shop?category=${params.slug}`)
}
