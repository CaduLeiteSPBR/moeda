import React, { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    // Salva o token e busca o usuário
    localStorage.setItem('coinhub_token', token)
    api.users.me()
      .then((user) => {
        setAuth(user, token)
        navigate('/feed', { replace: true })
      })
      .catch(() => {
        localStorage.removeItem('coinhub_token')
        navigate('/login?error=auth_failed', { replace: true })
      })
  }, [searchParams, navigate, setAuth])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-muted-foreground">Autenticando...</p>
      </motion.div>
    </div>
  )
}
