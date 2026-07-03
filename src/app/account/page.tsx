"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { useAuthStore } from "@/store/auth"
import { LogOut, User, Mail, ShieldCheck } from "lucide-react"

export default function AccountPage() {
  const [mounted, setMounted] = useState(false)
  const { isLoggedIn, user, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    if (mounted && !isLoggedIn) {
      router.push("/login")
    }
  }, [mounted, isLoggedIn, router])

  if (!mounted || !isLoggedIn || !user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-muted/20 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-4 mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">Akun Saya</h1>
            <div className="flex items-center gap-1 rounded-full bg-brand-green/10 px-3 py-1 text-sm font-semibold text-brand-green">
              <ShieldCheck className="h-4 w-4" />
              Member
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Sidebar */}
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-green/20 text-brand-green text-2xl font-bold uppercase">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-bold">{user.name}</h2>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <button className="flex w-full items-center gap-3 bg-muted/50 px-6 py-4 text-sm font-medium border-l-4 border-brand-green">
                  <User className="h-5 w-5 text-brand-green" />
                  Profil Saya
                </button>
                {/* Additional tabs could go here */}
                <button 
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-6 py-4 text-sm font-medium text-sale-red hover:bg-muted/50 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  Keluar
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="md:col-span-2">
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-bold mb-6">Informasi Profil</h3>
                
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Nama Lengkap</label>
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Alamat Email</label>
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{user.email}</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-blue-50 p-4 border border-blue-100">
                    <h4 className="font-bold text-blue-900 mb-1">Keuntungan Member Anda</h4>
                    <p className="text-sm text-blue-800">
                      Sebagai member, Anda secara otomatis mendapatkan potongan harga khusus di seluruh produk bertanda Harga Member.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
