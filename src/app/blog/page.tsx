import Image from "next/image"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"
import { ShopPagination } from "@/features/shop/components/shop-pagination"
import { getPostsPaginated } from "@/lib/api/wordpress/posts"
import { mapWpPostToUI } from "@/lib/api/wordpress/mapper"
import { formatDate } from "@/lib/utils"

const PER_PAGE = 12

export const metadata = {
  title: "Blog — HNS IT Center",
  description: "Tips, rekomendasi, dan berita seputar PC, laptop, dan gaming gear.",
}

type BlogPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const resolvedParams = await searchParams
  const requestedPage = Number(resolvedParams.page)
  const page = requestedPage > 0 ? requestedPage : 1

  const { posts: wpPosts, totalPages } = await getPostsPaginated({ page, perPage: PER_PAGE })
  const posts = wpPosts.map(mapWpPostToUI)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <Breadcrumb items={[{ label: "Beranda", href: "/" }, { label: "Blog" }]} />
      <main className="flex-1 bg-muted/20 py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">Blog</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              Tips, rekomendasi, dan berita seputar PC, laptop, dan gaming gear.
            </div>
          </div>

          {posts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                      <Image
                        src={post.imageUrl}
                        alt={post.imageAlt}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5">
                      {post.categoryNames.length > 0 && (
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-green">
                          {post.categoryNames[0]}
                        </span>
                      )}
                      <h2 className="mt-2 line-clamp-2 text-lg font-bold group-hover:text-brand-green">
                        {post.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                      <p className="mt-3 text-xs text-muted-foreground">{formatDate(post.date)}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <ShopPagination currentPage={page} totalPages={totalPages} basePath="/blog" />
            </>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border bg-card border-dashed p-8 text-center">
              <p className="text-lg font-medium text-muted-foreground">Belum ada artikel.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
