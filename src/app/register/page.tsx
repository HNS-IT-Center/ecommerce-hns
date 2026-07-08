"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { useAuthStore } from "@/store/auth"
import { Lock, Mail, User, Phone, ArrowRight } from "lucide-react"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const login = useAuthStore((state) => state.login)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email && password && name) {
      // TODO(SECURITY): auth masih simulasi, lihat src/store/auth.ts
      login(email)
      router.push("/account")
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center p-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 rounded-2xl border bg-card p-8 shadow-sm">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Daftar Akun Baru</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Daftar gratis untuk mendapatkan harga khusus member.
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Nama Lengkap</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 outline-none transition-colors focus:border-brand-green"
                    placeholder="Nama Anda"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Nomor WhatsApp</label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <input
                    type="tel"
                    required
                    className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 outline-none transition-colors focus:border-brand-green"
                    placeholder="081234567890"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 outline-none transition-colors focus:border-brand-green"
                    placeholder="nama@email.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 outline-none transition-colors focus:border-brand-green"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-brand-green/90"
            >
              Buat Akun <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-bold text-brand-green hover:underline">
              Masuk di sini
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
