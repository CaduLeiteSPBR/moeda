import { useAuthStore } from '../store/authStore'
import { api, LoginData } from '../lib/api'

export function useAuth() {
  const { user, token, isLoading, setAuth, logout, updateUser } = useAuthStore()

  const isAuthenticated = !!token && !!user
  const isAdmin = isAuthenticated && !!user?.is_admin

  const login = async (data: LoginData) => {
    const res = await api.auth.login(data)
    setAuth(res.user, res.token)
    return res
  }

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    updateUser,
  }
}
