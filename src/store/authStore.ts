import { create } from 'zustand'
import { api, User } from '../lib/api'

const TOKEN_KEY = 'coinhub_token'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user: User, token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ user, token, isLoading: false })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null, isLoading: false })
  },

  updateUser: (updatedUser: Partial<User>) => {
    const current = get().user
    if (current) {
      set({ user: { ...current, ...updatedUser } })
    }
  },

  initialize: async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ isLoading: false })
      return
    }
    set({ token, isLoading: true })
    try {
      const user = await api.users.me()
      set({ user, token, isLoading: false })
    } catch {
      // Token inválido ou expirado
      localStorage.removeItem(TOKEN_KEY)
      set({ user: null, token: null, isLoading: false })
    }
  },
}))
