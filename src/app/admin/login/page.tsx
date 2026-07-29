import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Masuk Admin — HNS IT Center",
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams

  // Sudah masuk tapi membuka halaman login lagi — antar saja ke tujuannya,
  // jangan menampilkan formulir yang tidak ada gunanya diisi.
  if (await getCurrentUser()) redirect("/admin")

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-bold">Masuk Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Halaman ini khusus pengelola katalog HNS IT Center.
        </p>

        <div className="mt-6">
          <LoginForm callbackUrl={callbackUrl ?? "/admin"} />
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Akun dibuat oleh pengelola sistem — tidak ada pendaftaran mandiri.
        </p>
      </div>
    </div>
  )
}
