import type { WPPost } from "@/types/wordpress"
import { stripHtml } from "@/lib/utils/html"

export type UIBlogPost = {
  id: number
  slug: string
  title: string
  excerpt: string
  date: string
  imageUrl: string
  imageAlt: string
  categoryNames: string[]
}

export function mapWpPostToUI(post: WPPost): UIBlogPost {
  const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0]
  const categoryNames = (post._embedded?.["wp:term"]?.[0] ?? []).map((term) => term.name)

  return {
    id: post.id,
    slug: post.slug,
    title: stripHtml(post.title.rendered),
    excerpt: stripHtml(post.excerpt.rendered),
    date: post.date,
    imageUrl: featuredMedia?.source_url ?? "/images/placeholder.svg",
    imageAlt: featuredMedia?.alt_text || stripHtml(post.title.rendered),
    categoryNames,
  }
}
