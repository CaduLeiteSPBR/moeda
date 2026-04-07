import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api, Item } from '../lib/api'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import FeedCard from '../components/feed/FeedCard'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import ItemForm from '../components/collection/ItemForm'

function FeedSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-border">
          <Skeleton className="aspect-square w-full" />
          <div className="p-2.5 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Feed() {
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<'all' | 'following'>('all')
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const loadFeed = useCallback(async (feedType: 'all' | 'following', feedPage: number, append = false) => {
    if (feedPage === 1) setIsLoading(true)
    else setLoadingMore(true)
    try {
      const res = await api.feed.get(feedType, feedPage)
      if (append) {
        setItems((prev) => [...prev, ...res.data])
      } else {
        setItems(res.data)
      }
      setHasMore(feedPage < res.pagination.totalPages)
      setPage(feedPage)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar feed',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setLoadingMore(false)
    }
  }, [toast])

  useEffect(() => {
    loadFeed(tab, 1, false)
  }, [tab, loadFeed])

  const handleTabChange = (value: string) => {
    setTab(value as 'all' | 'following')
  }

  const handleLoadMore = () => {
    loadFeed(tab, page + 1, true)
  }

  const handleItemCreated = () => {
    setShowAddModal(false)
    loadFeed(tab, 1, false)
    toast({ title: 'Item adicionado com sucesso!', variant: 'success' as 'default' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feed</h1>
      </div>

      {isAuthenticated ? (
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Todos</TabsTrigger>
            <TabsTrigger value="following" className="flex-1">Seguindo</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {isLoading ? (
              <FeedSkeleton />
            ) : items.length === 0 ? (
              <EmptyFeed />
            ) : (
              <FeedGrid items={items} />
            )}
          </TabsContent>

          <TabsContent value="following" className="mt-4">
            {isLoading ? (
              <FeedSkeleton />
            ) : items.length === 0 ? (
              <EmptyFollowingFeed />
            ) : (
              <FeedGrid items={items} />
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="mt-4">
          {isLoading ? (
            <FeedSkeleton />
          ) : items.length === 0 ? (
            <EmptyFeed />
          ) : (
            <FeedGrid items={items} />
          )}
        </div>
      )}

      {hasMore && !isLoading && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
            ) : (
              'Carregar mais'
            )}
          </Button>
        </div>
      )}

      {/* FAB - Adicionar item */}
      {isAuthenticated && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        >
          <Plus className="h-6 w-6" />
        </motion.button>
      )}

      {/* Modal de adicionar item */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
          </DialogHeader>
          <ItemForm
            onSuccess={handleItemCreated}
            onCancel={() => setShowAddModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FeedGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item, i) => (
        <FeedCard key={item.id} item={item} index={i} />
      ))}
    </div>
  )
}

function EmptyFeed() {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p className="text-lg font-medium">Nenhum item encontrado</p>
      <p className="text-sm mt-1">Seja o primeiro a adicionar uma moeda ou cédula!</p>
    </div>
  )
}

function EmptyFollowingFeed() {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p className="text-lg font-medium">Nada por aqui ainda</p>
      <p className="text-sm mt-1">Siga outros colecionadores para ver suas adições.</p>
    </div>
  )
}
