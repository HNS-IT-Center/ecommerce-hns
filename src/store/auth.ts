import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface User {
  id: string
  name: string
  email: string
}

interface AuthState {
  isLoggedIn: boolean
  user: User | null
  login: (email: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      // TODO(SECURITY, 2026-07-07): login() ini 100% simulasi client-side.
      // Tidak menerima/verifikasi password sama sekali (form login/register
      // membuang password, tidak pernah dikirim ke sini). State hanya disimpan
      // di localStorage lewat Zustand persist — siapapun bisa isi email apa
      // saja dan langsung "login" jadi user manapun.
      // WAJIB diganti ke WooCommerce Customer API sebelum go-live
      // (keputusan sudah diambil: Opsi A, lihat CONTEXT-HANDOFF.md §3).
      login: (email: string) => {
        set({
          isLoggedIn: true,
          user: {
            id: "u" + Math.floor(Math.random() * 10000),
            name: email.split("@")[0], // Pakai awalan email sbg nama
            email: email,
          },
        })
      },
      logout: () => {
        set({
          isLoggedIn: false,
          user: null,
        })
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
