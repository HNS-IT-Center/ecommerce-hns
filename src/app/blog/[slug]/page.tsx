import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"
import { getPostBySlug } from "@/lib/api/wordpress/posts"
import { mapWpPostToUI } from "@/lib/api/wordpress/mapper"
import { formatDate } from "@/lib/utils"

type BlogPostPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: "Artikel tidak ditemukan — HNS IT Center" }

  const ui = mapWpPostToUI(post)
  return {
    title: `${ui.title} — HNS IT Center`,
    description: ui.excerpt.slice(0, 160),
    openGraph: { images: [ui.imageUrl] },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) notFound()

  const ui = mapWpPostToUI(post)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <Breadcrumb
        items={[
          { label: "Beranda", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: ui.title },
        ]}
      />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
          {post.categories.length > 0 && ui.categoryNames[0] && (
            <span className="text-sm font-bold uppercase tracking-wider text-brand-green">
              {ui.categoryNames[0]}
            </span>
          )}
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">{ui.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{formatDate(ui.date)}</p>

          <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-2xl bg-muted">
            <Image src={ui.imageUrl} alt={ui.imageAlt} fill className="object-cover" priority />
          </div>

          <div
            className="prose prose-sm mt-8 max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: post.content.rendered }}
          />
        </article>
      </main>
      <Footer />
    </div>
  )
}
