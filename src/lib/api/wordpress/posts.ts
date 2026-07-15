import { wpFetch, wpFetchWithMeta } from "./client"
import type { WPPost } from "@/types/wordpress"

type GetPostsParams = {
  page?: number
  perPage?: number
}

export type GetPostsPaginatedResult = {
  posts: WPPost[]
  total: number
  totalPages: number
}

export async function getPostsPaginated(
  params: GetPostsParams = {}
): Promise<GetPostsPaginatedResult> {
  const query = new URLSearchParams()
  query.set("per_page", String(params.perPage ?? 12))
  if (params.page) query.set("page", String(params.page))
  query.set("_embed", "true")

  const { data, meta } = await wpFetchWithMeta<WPPost[]>(`/posts?${query.toString()}`, {
    next: { revalidate: 3600, tags: ["blog"] },
  })

  return { posts: data, total: meta.total, totalPages: meta.totalPages }
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const posts = await wpFetch<WPPost[]>(`/posts?slug=${slug}&_embed=true`, {
    next: { revalidate: 3600, tags: [`post-${slug}`] },
  })
  return posts[0] ?? null
}
