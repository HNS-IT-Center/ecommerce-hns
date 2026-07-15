export type WPRendered = {
  rendered: string
}

export type WPPost = {
  id: number
  date: string
  slug: string
  title: WPRendered
  content: WPRendered
  excerpt: WPRendered
  featured_media: number
  categories: number[]
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url: string
      alt_text: string
    }>
    "wp:term"?: Array<Array<{ id: number; name: string; slug: string }>>
  }
}
