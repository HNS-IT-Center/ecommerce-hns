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
      login: (email: string) => {
        // Simulasi data user
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
