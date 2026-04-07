import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coins, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'
import { useToast } from '../hooks/use-toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { api } from '../lib/api'

export default function Register() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    city: '',
    birth_date: '',
    whatsapp: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.city) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }
    if (form.password !== form.confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' })
      return
    }
    if (form.password.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      await api.auth.register({
        name: form.name,
        email: form.email,
        password: form.password,
        city: form.city,
        birth_date: form.birth_date || undefined,
        whatsapp: form.whatsapp || undefined,
      })
      setSuccess(true)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao registrar',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm w-full"
        >
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 dark:bg-green-900/20 rounded-full p-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Conta criada!</h2>
          <p className="text-muted-foreground mb-6">
            Enviamos um link de verificação para <strong>{form.email}</strong>. Por favor, verifique seu e-mail para ativar a conta.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Ir para o Login</Link>
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-primary/10 border-2 border-primary/20 rounded-full p-4 mb-3">
            <Coins className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">
            Coin<span className="text-primary">Hub</span>
          </h1>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-xl">Criar Conta</CardTitle>
            <CardDescription className="text-center">
              Comece sua coleção hoje
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Seu nome"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="Sua cidade"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="birth_date">Data de Nascimento <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  id="birth_date"
                  name="birth_date"
                  type="date"
                  value={form.birth_date}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="whatsapp">WhatsApp <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={form.whatsapp}
                  onChange={handleChange}
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Registrar'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-5">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
