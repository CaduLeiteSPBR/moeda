import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MapPin, Loader2, Layers } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api, Item, User } from '../lib/api'
import { Button } from '../components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Skeleton } from '../components/ui/skeleton'
import ItemCard from '../components/collection/ItemCard'
import { getInitials, getImageUrl } from '../lib/utils'

export default function UserCollection() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: me, isAuthenticated } = useAuth()
  const { toast } = useToast()

  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const [userRes, itemsRes] = await Promise.all([
        api.users.getById(id),
        api.items.list({ user_id: id, page: 1 }),
      ])
      setProfileUser(userRes)
      setItems(itemsRes.data)
      setHasMore(1 < itemsRes.pagination.totalPages)
      setPage(1)
    } catch (err: unknown) {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' })
    } finally {
      setFollowLoading(false)
    }
  }

  const loadMore = async () => {
    if (!id) return
    setLoadingMore(true)
    try {
      const res = await api.items.list({ user_id: id, page: page + 1 })
      setItems((prev) => [...prev, ...res.data])
      setHasMore(page + 1 < res.pagination.totalPages)
      setPage((p) => p + 1)
    } catch {
      toast({ title: 'Erro ao carregar mais itens', variant: 'destructive' })
    } finally {
      setLoadingMore(false)
    }
  }

  const isOwner = me?.id === id

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Usuário não encontrado</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header de navegação */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      {/* Perfil do usuário */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4"
      >
        <Avatar className="h-14 w-14">
          <AvatarImage src={getImageUrl(profileUser.avatar_url) ?? undefined} />
          <AvatarFallback className="text-lg">
            {getInitials(profileUser.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base truncate">{profileUser.name}</p>
          {profileUser.city && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {profileUser.city}
            </p>
          )}
          <div className="flex gap-3 mt-1">
            <span className="text-xs text-muted-foreground">
              <strong>{profileUser.followers_count ?? 0}</strong> seguidores
            </span>
            <span className="text-xs text-muted-foreground">
              <strong>{items.length}</strong> itens
            </span>
          </div>
        </div>

        {isAuthenticated && !isOwner && (
          <Button
            size="sm"
            variant={isFollowing ? 'outline' : 'default'}
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
        )}
      </motion.div>

      {/* Título */}
      <h2 className="text-xl font-bold">
        {isOwner ? 'Minha Coleção' : `Coleção de ${profileUser.name.split(' ')[0]}`}
      </h2>

      {/* Grid de itens */}
      {items.length === 0 ? (
        <div className="text-center py-16">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum item na coleção ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <ItemCard item={item} isOwner={isOwner} />
            </motion.div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
            ) : (
              'Carregar mais'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
