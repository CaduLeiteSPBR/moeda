import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MapPin, Calendar, Loader2, MessageCircle, Layers } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api, User } from '../lib/api'
import { Button } from '../components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Skeleton } from '../components/ui/skeleton'
import { Separator } from '../components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { getInitials, getImageUrl, formatDate } from '../lib/utils'

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: me, isAuthenticated } = useAuth()
  const { toast } = useToast()

  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageContent, setMessageContent] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    api.users.getById(id)
      .then(setProfileUser)
      .catch(() => toast({ title: 'Usuário não encontrado', variant: 'destructive' }))
      .finally(() => setIsLoading(false))
  }, [id, toast])

  const handleFollow = async () => {
    if (!id || !isAuthenticated) return
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await api.users.unfollow(id)
        setIsFollowing(false)
        setProfileUser((prev) => prev ? { ...prev, followers_count: (prev.followers_count || 1) - 1 } : prev)
      } else {
        await api.users.follow(id)
        setIsFollowing(true)
        setProfileUser((prev) => prev ? { ...prev, followers_count: (prev.followers_count || 0) + 1 } : prev)
      }
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setFollowLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!id || !messageContent.trim()) return
    setIsSendingMessage(true)
    try {
      await api.messages.send({ receiver_id: id, content: messageContent.trim() })
      setMessageContent('')
      setShowMessageModal(false)
      toast({ title: 'Mensagem enviada!', variant: 'success' as 'default' })
    } catch (err: unknown) {
      toast({ title: 'Erro ao enviar mensagem', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsSendingMessage(false)
    }
  }

  const isOwner = me?.id === id

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-20" />
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Usuário não encontrado</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">Voltar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Voltar */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      {/* Cabeçalho do perfil */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <Avatar className="h-24 w-24 ring-4 ring-primary/20">
          <AvatarImage src={getImageUrl(profileUser.avatar_url) ?? undefined} />
          <AvatarFallback className="text-2xl">
            {getInitials(profileUser.name)}
          </AvatarFallback>
        </Avatar>

        <div>
          <h1 className="text-2xl font-bold">{profileUser.name}</h1>
          {profileUser.city && (
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              {profileUser.city}
            </p>
          )}
          {profileUser.created_at && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Calendar className="h-3 w-3" />
              Membro desde {formatDate(profileUser.created_at)}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-8">
          <div className="text-center">
            <p className="font-bold text-lg">{(profileUser as { items_count?: number })?.items_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">Itens</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{profileUser.followers_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">Seguidores</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{profileUser.following_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">Seguindo</p>
          </div>
        </div>

        {/* Ações */}
        {isAuthenticated && !isOwner && (
          <div className="flex gap-3 w-full max-w-xs">
            <Button
              variant={isFollowing ? 'outline' : 'default'}
              className="flex-1"
              onClick={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                'Seguindo'
              ) : (
                'Seguir'
              )}
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={() => setShowMessageModal(true)}>
              <MessageCircle className="h-4 w-4" />
              Mensagem
            </Button>
          </div>
        )}

        {isOwner && (
          <Button variant="outline" asChild>
            <Link to="/profile">Editar Perfil</Link>
          </Button>
        )}
      </motion.div>

      <Separator />

      {/* Link para coleção */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Button variant="outline" className="w-full gap-3 h-14 justify-start" asChild>
          <Link to={`/users/${profileUser.id}/collection`}>
            <div className="bg-primary/10 rounded-lg p-2">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">
                {isOwner ? 'Minha Coleção' : `Coleção de ${profileUser.name.split(' ')[0]}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {(profileUser as { items_count?: number })?.items_count ?? 0} itens
              </p>
            </div>
          </Link>
        </Button>
      </motion.div>

      {/* Modal de mensagem */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar Mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Para: <strong>{profileUser.name}</strong></p>
            <div className="space-y-1.5">
              <Label htmlFor="messageContent">Mensagem</Label>
              <Textarea
                id="messageContent"
                placeholder="Escreva sua mensagem..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMessageModal(false)} disabled={isSendingMessage}>
              Cancelar
            </Button>
            <Button onClick={handleSendMessage} disabled={isSendingMessage || !messageContent.trim()}>
              {isSendingMessage ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                'Enviar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
