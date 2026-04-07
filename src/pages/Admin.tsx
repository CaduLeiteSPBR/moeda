import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Shield, Loader2, Eye, EyeOff, RotateCcw, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api, User, Message } from '../lib/api'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog'
import { getInitials, getImageUrl, formatDate, formatRelativeDate, truncate } from '../lib/utils'

function UserSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-border">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MessageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 rounded-2xl border border-border">
          <Skeleton className="h-4 w-2/3 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const { isAdmin, isLoading: authLoading } = useAuth()
  const { toast } = useToast()

  const [userQuery, setUserQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [userPage, setUserPage] = useState(1)
  const [userHasMore, setUserHasMore] = useState(false)
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [msgPage, setMsgPage] = useState(1)
  const [msgHasMore, setMsgHasMore] = useState(false)
  const [loadingMoreMsgs, setLoadingMoreMsgs] = useState(false)

  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/feed', { replace: true })
    }
  }, [isAdmin, authLoading, navigate])

  const loadUsers = useCallback(async (q: string, p: number, append = false) => {
    if (p === 1) setIsLoadingUsers(true)
    else setLoadingMoreUsers(true)
    try {
      const res = await api.admin.users({ page: p, q: q || undefined })
      if (append) {
        setUsers((prev) => [...prev, ...res.data])
      } else {
        setUsers(res.data)
      }
      setUserHasMore(p < res.pagination.totalPages)
      setUserPage(p)
    } catch (err: unknown) {
      toast({ title: 'Erro ao carregar usuários', variant: 'destructive' })
    } finally {
      setIsLoadingUsers(false)
      setLoadingMoreUsers(false)
    }
  }, [toast])

  const loadMessages = useCallback(async (p: number, append = false) => {
    if (p === 1) setIsLoadingMessages(true)
    else setLoadingMoreMsgs(true)
    try {
      const res = await api.messages.adminAll(p)
      if (append) {
        setMessages((prev) => [...prev, ...res.data])
      } else {
        setMessages(res.data)
      }
      setMsgHasMore(p < res.pagination.totalPages)
      setMsgPage(p)
    } catch (err: unknown) {
      toast({ title: 'Erro ao carregar mensagens', variant: 'destructive' })
    } finally {
      setIsLoadingMessages(false)
      setLoadingMoreMsgs(false)
    }
  }, [toast])

  useEffect(() => {
    if (isAdmin) {
      loadUsers('', 1, false)
    }
  }, [isAdmin, loadUsers])

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadUsers(userQuery, 1, false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [userQuery, loadUsers])

  const handleTabChange = (v: string) => {
    if (v === 'messages' && messages.length === 0) {
      loadMessages(1, false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword.trim()) return
    if (newPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }
    setIsResetting(true)
    try {
      await api.admin.resetPassword(resetTarget.id, newPassword)
      setResetTarget(null)
      setNewPassword('')
      toast({ title: 'Senha redefinida com sucesso!', variant: 'success' as 'default' })
    } catch (err: unknown) {
      toast({ title: 'Erro ao redefinir senha', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsResetting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Administração</h1>
      </div>

      <Tabs defaultValue="users" onValueChange={handleTabChange}>
        <TabsList className="w-full">
          <TabsTrigger value="users" className="flex-1">Usuários</TabsTrigger>
          <TabsTrigger value="messages" className="flex-1">Mensagens</TabsTrigger>
        </TabsList>

        {/* Tab Usuários */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoadingUsers ? (
            <UserSkeleton />
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={getImageUrl(u.avatar_url) ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      {u.is_admin && <Badge className="text-[10px] px-1.5 py-0">Admin</Badge>}
                      {u.is_verified ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="flex gap-2 mt-0.5">
                      {u.city && <span className="text-[11px] text-muted-foreground">{u.city}</span>}
                      {u.created_at && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(u.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8 text-xs gap-1"
                    onClick={() => { setResetTarget(u); setNewPassword('') }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Senha
                  </Button>
                </motion.div>
              ))}

              {userHasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadUsers(userQuery, userPage + 1, true)}
                    disabled={loadingMoreUsers}
                  >
                    {loadingMoreUsers ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
                    ) : (
                      'Carregar mais'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab Mensagens */}
        <TabsContent value="messages" className="mt-4 space-y-4">
          {isLoadingMessages ? (
            <MessageSkeleton />
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhuma mensagem encontrada
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-3 rounded-2xl border border-border bg-card"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-xs text-muted-foreground shrink-0">De:</p>
                      <p className="text-sm font-medium truncate">
                        {msg.sender?.name}
                        {msg.sender?.city && <span className="text-muted-foreground font-normal"> ({msg.sender.city})</span>}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeDate(msg.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs text-muted-foreground shrink-0">Para:</p>
                    <p className="text-sm truncate">
                      {msg.receiver?.name}
                      {msg.receiver?.city && <span className="text-muted-foreground"> ({msg.receiver.city})</span>}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted rounded-lg px-2.5 py-1.5">
                    {truncate(msg.content, 120)}
                  </p>
                </motion.div>
              ))}

              {msgHasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMessages(msgPage + 1, true)}
                    disabled={loadingMoreMsgs}
                  >
                    {loadingMoreMsgs ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
                    ) : (
                      'Carregar mais'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de reset de senha */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Definir nova senha para <strong>{resetTarget?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adminNewPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="adminNewPassword"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={isResetting}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={isResetting || !newPassword.trim()}>
              {isResetting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                'Redefinir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
