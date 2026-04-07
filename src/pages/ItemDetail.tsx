import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Coins, FileText, MapPin, ArrowLeftRight,
  Edit, Trash2, Share2, RotateCcw, Loader2, Calendar
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api, Item } from '../lib/api'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Skeleton } from '../components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog'
import InterestButton from '../components/messages/InterestButton'
import ItemForm from '../components/collection/ItemForm'
import { cn, getInitials, getImageUrl, getItemLabel, formatCurrency, formatDate } from '../lib/utils'

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()

  const [item, setItem] = useState<Item | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showBack, setShowBack] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    api.items.getById(id)
      .then(setItem)
      .catch(() => toast({ title: 'Erro ao carregar item', variant: 'destructive' }))
      .finally(() => setIsLoading(false))
  }, [id, toast])

  const isOwner = user?.id === item?.user_id

  const frontUrl = getImageUrl(item?.front_image_url)
  const backUrl = getImageUrl(item?.back_image_url)
  const currentUrl = showBack ? backUrl : frontUrl

  const handleDelete = async () => {
    if (!item) return
    setIsDeleting(true)
    try {
      await api.items.delete(item.id)
      toast({ title: 'Item excluído', variant: 'success' as 'default' })
      navigate(-1)
    } catch (err: unknown) {
      toast({ title: 'Erro ao excluir', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${item?.country} ${item?.year} - CoinHub`,
          url,
        })
      } catch {
        // Usuário cancelou
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copiado!', variant: 'success' as 'default' })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Item não encontrado</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <Button variant="ghost" size="icon" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Imagem principal */}
      <div className="rounded-2xl overflow-hidden border border-border bg-muted aspect-square relative group">
        <AnimatePresence mode="wait">
          <motion.div
            key={showBack ? 'back' : 'front'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            {currentUrl ? (
              <img
                src={currentUrl}
                alt={showBack ? 'Verso' : 'Frente'}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {item.type === 'coin' ? (
                  <Coins className="h-20 w-20 text-muted-foreground/30" />
                ) : (
                  <FileText className="h-20 w-20 text-muted-foreground/30" />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <Badge>{getItemLabel(item.type)}</Badge>
          {item.available_for_trade && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3" />
              À troca
            </Badge>
          )}
        </div>

        {/* Botão flip */}
        {backUrl && (
          <button
            onClick={() => setShowBack(!showBack)}
            className="absolute bottom-3 right-3 bg-background/80 rounded-full px-3 py-1.5 backdrop-blur-sm text-xs flex items-center gap-1.5 border border-border"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {showBack ? 'Ver frente' : 'Ver verso'}
          </button>
        )}
      </div>

      {/* Informações do item */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold">{item.country}</h1>
          <div className="flex flex-wrap gap-2 mt-1">
            {item.year && (
              <span className="text-muted-foreground text-sm flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {item.year}
              </span>
            )}
            {item.denomination && item.currency && (
              <span className="text-muted-foreground text-sm font-medium">
                {formatCurrency(item.denomination, item.currency)}
              </span>
            )}
          </div>
        </div>

        {item.commemorative_edition && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
            <p className="text-sm text-primary font-medium">{item.commemorative_edition}</p>
          </div>
        )}

        {item.quantity > 1 && (
          <p className="text-sm text-muted-foreground">Quantidade: <strong>{item.quantity}</strong></p>
        )}

        {item.description && (
          <div>
            <p className="text-sm font-medium mb-1">Descrição</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </div>
        )}

        {item.created_at && (
          <p className="text-xs text-muted-foreground">
            Adicionado em {formatDate(item.created_at)}
          </p>
        )}
      </div>

      {/* Ações do dono */}
      {isOwner && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => setShowEditModal(true)}
          >
            <Edit className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 text-destructive hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      )}

      {/* Botão de interesse (para outros usuários) */}
      {isAuthenticated && !isOwner && (
        <InterestButton
          itemId={item.id}
          isInterested={item.is_interested ?? false}
          onToggle={(interested) => setItem((prev) => prev ? { ...prev, is_interested: interested } : prev)}
        />
      )}

      {/* Proprietário */}
      {item.user && (
        <div className="border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">Proprietário</p>
          <Link to={`/users/${item.user.id}`} className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={getImageUrl(item.user.avatar_url) ?? undefined} />
              <AvatarFallback>{getInitials(item.user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{item.user.name}</p>
              {item.user.city && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.user.city}
                </p>
              )}
            </div>
          </Link>
          <Button variant="outline" size="sm" className="w-full mt-3" asChild>
            <Link to={`/users/${item.user.id}/collection`}>
              Ver coleção completa
            </Link>
          </Button>
        </div>
      )}

      {/* Modal de edição */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
          </DialogHeader>
          <ItemForm
            item={item}
            onSuccess={(updated) => {
              setItem(updated)
              setShowEditModal(false)
              toast({ title: 'Item atualizado!', variant: 'success' as 'default' })
            }}
            onCancel={() => setShowEditModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Item</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Excluindo...</> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
