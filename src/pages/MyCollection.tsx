import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Layers, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api, Item } from '../lib/api'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import ItemCard from '../components/collection/ItemCard'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import ItemForm from '../components/collection/ItemForm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'

function CollectionSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-border">
          <Skeleton className="aspect-square w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function MyCollection() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'coin' | 'note'>('all')
  const [tradeFilter, setTradeFilter] = useState(false)

  const loadItems = useCallback(async (p: number, append = false) => {
    if (!user) return
    if (p === 1) setIsLoading(true)
    else setLoadingMore(true)

    try {
      const res = await api.items.list({
        user_id: user.id,
        page: p,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        available_for_trade: tradeFilter || undefined,
      })
      if (append) {
        setItems((prev) => [...prev, ...res.data])
      } else {
        setItems(res.data)
      }
      setHasMore(p < res.pagination.totalPages)
      setPage(p)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar coleção',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setLoadingMore(false)
    }
  }, [user, typeFilter, tradeFilter, toast])

  useEffect(() => {
    loadItems(1, false)
  }, [loadItems])

  const handleItemCreated = (newItem: Item) => {
    setShowAddModal(false)
    setItems((prev) => [newItem, ...prev])
    toast({ title: 'Item adicionado!', variant: 'success' as 'default' })
  }

  const handleItemDeleted = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleItemUpdated = (updatedItem: Item) => {
    setItems((prev) => prev.map((i) => i.id === updatedItem.id ? updatedItem : i))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Minha Coleção</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'coin' | 'note')}>
          <SelectTrigger className="w-36 h-9">
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
            id="tradeFilter"
            checked={tradeFilter}
            onCheckedChange={setTradeFilter}
          />
          <Label htmlFor="tradeFilter" className="text-sm cursor-pointer">Só para troca</Label>
        </div>
      </div>

      {/* Grid de itens */}
      {isLoading ? (
        <CollectionSkeleton />
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-4 text-center"
        >
          <div className="bg-muted rounded-full p-6">
            <Layers className="h-12 w-12 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold">Sua coleção está vazia</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione sua primeira moeda ou cédula</p>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Item
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <ItemCard
                item={item}
                isOwner={true}
                onDeleted={handleItemDeleted}
                onUpdated={handleItemUpdated}
              />
            </motion.div>
          ))}
        </div>
      )}

      {hasMore && !isLoading && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={() => loadItems(page + 1, true)} disabled={loadingMore}>
            {loadingMore ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
            ) : (
              'Carregar mais'
            )}
          </Button>
        </div>
      )}

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      {/* Modal de adicionar */}
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
