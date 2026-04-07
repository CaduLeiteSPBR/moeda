import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search as SearchIcon, MapPin, Users, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api, Item, User } from '../lib/api'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Skeleton } from '../components/ui/skeleton'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import FeedCard from '../components/feed/FeedCard'
import { getInitials, getImageUrl } from '../lib/utils'

function ItemSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-border">
          <Skeleton className="aspect-square w-full" />
          <div className="p-3 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function UserSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-border">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Search() {
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('items')
  const [typeFilter, setTypeFilter] = useState<'all' | 'coin' | 'note'>('all')
  const [tradeFilter, setTradeFilter] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const searchItems = useCallback(async (q: string) => {
    setIsLoadingItems(true)
    try {
      const res = await api.items.list({
        q,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        available_for_trade: tradeFilter || undefined,
      })
      setItems(res.data)
    } catch {
      // silencia erro
    } finally {
      setIsLoadingItems(false)
    }
  }, [typeFilter, tradeFilter])

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setUsers([]); return }
    setIsLoadingUsers(true)
    try {
      const res = await api.users.search(q)
      setUsers(res.data)
    } catch {
      // silencia erro
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (tab === 'items') {
        searchItems(query)
      } else {
        searchUsers(query)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, tab, typeFilter, tradeFilter, searchItems, searchUsers])

  const handleFollow = async (userId: string) => {
    if (!isAuthenticated) return
    setFollowLoading((prev) => ({ ...prev, [userId]: true }))
    try {
      if (followingMap[userId]) {
        await api.users.unfollow(userId)
        setFollowingMap((prev) => ({ ...prev, [userId]: false }))
      } else {
        await api.users.follow(userId)
        setFollowingMap((prev) => ({ ...prev, [userId]: true }))
      }
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setFollowLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buscar</h1>

      {/* Campo de busca */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar moedas, cédulas, usuários..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-base"
          autoFocus
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="items" className="flex-1">Itens</TabsTrigger>
          <TabsTrigger value="users" className="flex-1">Usuários</TabsTrigger>
        </TabsList>

        {/* Tab Itens */}
        <TabsContent value="items" className="mt-4 space-y-4">
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'coin' | 'note')}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="coin">Moedas</SelectItem>
                <SelectItem value="note">Cédulas</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="tradeFilterSearch"
                checked={tradeFilter}
                onCheckedChange={setTradeFilter}
              />
              <Label htmlFor="tradeFilterSearch" className="text-sm cursor-pointer">Só para troca</Label>
            </div>
          </div>

          {isLoadingItems ? (
            <ItemSkeleton />
          ) : !query && items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <SearchIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Digite para buscar itens</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>Nenhum item encontrado para "<strong>{query}</strong>"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((item, i) => (
                <FeedCard key={item.id} item={item} index={i} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab Usuários */}
        <TabsContent value="users" className="mt-4">
          {isLoadingUsers ? (
            <UserSkeleton />
          ) : !query ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Digite para buscar usuários</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>Nenhum usuário encontrado para "<strong>{query}</strong>"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card"
                >
                  <Link to={`/users/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={getImageUrl(u.avatar_url) ?? undefined} />
                      <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.name}</p>
                      {u.city && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{u.city}</span>
                        </p>
                      )}
                      {u.items_count !== undefined && (
                        <p className="text-xs text-muted-foreground">{u.items_count} itens</p>
                      )}
                    </div>
                  </Link>

                  {isAuthenticated && (
                    <Button
                      size="sm"
                      variant={followingMap[u.id] ? 'outline' : 'default'}
                      onClick={() => handleFollow(u.id)}
                      disabled={followLoading[u.id]}
                      className="shrink-0"
                    >
                      {followLoading[u.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : followingMap[u.id] ? (
                        'Seguindo'
                      ) : (
                        'Seguir'
                      )}
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
