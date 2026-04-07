import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { useToast } from '../hooks/use-toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { api } from '../lib/api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle')
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('idle')
      return
    }
    setStatus('loading')
    api.auth.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail) return
    setResendLoading(true)
    try {
      await api.auth.resendVerification(resendEmail)
      setResendSent(true)
      toast({ title: 'E-mail enviado!', description: 'Verifique sua caixa de entrada.', variant: 'success' as 'default' })
    } catch (err: unknown) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full text-center"
      >
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <h2 className="text-xl font-semibold">Verificando e-mail...</h2>
            <p className="text-muted-foreground">Aguarde um momento</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/20 rounded-full p-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold">E-mail verificado!</h2>
            <p className="text-muted-foreground">
              Sua conta foi ativada com sucesso. Agora você pode entrar.
            </p>
            <Button asChild className="w-full mt-2">
              <Link to="/login">Ir para o Login</Link>
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">Link inválido</h2>
            <p className="text-muted-foreground">
              O link de verificação é inválido ou expirou. Solicite um novo abaixo.
            </p>

            {!resendSent ? (
              <form onSubmit={handleResend} className="w-full space-y-3 mt-2">
                <div className="space-y-1 text-left">
                  <Label htmlFor="resendEmail">Seu e-mail</Label>
                  <Input
                    id="resendEmail"
                    type="email"
                    placeholder="seu@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resendLoading}>
                  {resendLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    'Reenviar verificação'
                  )}
                </Button>
              </form>
            ) : (
              <div className="w-full bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-green-700 dark:text-green-300 text-sm">
                E-mail reenviado! Verifique sua caixa de entrada.
              </div>
            )}

            <Link to="/login" className="text-sm text-primary hover:underline">
              Voltar ao login
            </Link>
          </div>
        )}

        {status === 'idle' && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-primary/10 rounded-full p-4">
              <Mail className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Verifique seu e-mail</h2>
            <p className="text-muted-foreground">
              Clique no link que enviamos para seu e-mail para ativar sua conta.
            </p>

            {!resendSent ? (
              <form onSubmit={handleResend} className="w-full space-y-3 mt-2">
                <div className="space-y-1 text-left">
                  <Label htmlFor="resendEmailIdle">Não recebeu? Digite seu e-mail:</Label>
                  <Input
                    id="resendEmailIdle"
                    type="email"
                    placeholder="seu@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={resendLoading}>
                  {resendLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    'Reenviar e-mail'
                  )}
                </Button>
              </form>
            ) : (
              <div className="w-full bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-green-700 dark:text-green-300 text-sm">
                E-mail reenviado! Verifique sua caixa de entrada.
              </div>
            )}

            <Link to="/login" className="text-sm text-primary hover:underline">
              Voltar ao login
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}
