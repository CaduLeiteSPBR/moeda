import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit, Trash2, ArrowLeftRight, Coins, FileText, RotateCcw, Loader2 } from 'lucide-react'
import { Item, api } from '../../lib/api'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog'
import ItemForm from './ItemForm'
import { cn, getImageUrl, getItemLabel, formatCurrency } from '../../lib/utils'
import { useToast } from '../../hooks/use-toast'

interface ItemCardProps {
  item: Item
  isOwner?: boolean
  onDeleted?: (id: string) => void
  onUpdated?: (item: Item) => void
}

export default function ItemCard({ item, isOwner = false, onDeleted, onUpdated }: ItemCardProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [showBack, setShowBack] = useState(false)
  const [isFlipping, setIsFlipping] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const frontUrl = getImageUrl(item.front_image_key)
  const backUrl = getImageUrl(item.back_image_key)

  const handleFlip = () => {
    if (!backUrl) return
    setIsFlipping(true)
    setTimeout(() => {
      setShowBack((prev) => !prev)
      setIsFlipping(false)
    }, 150)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await api.items.delete(item.id)
      onDeleted?.(item.id)
      setShowDeleteConfirm(false)
      toast({ title: 'Item excluído', variant: 'success' as 'default' })
    } catch (err: unknown) {
      toast({
        title: 'Erro ao excluir',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdated = (updatedItem: Item) => {
    onUpdated?.(updatedItem)
    setShowEditModal(false)
    toast({ title: 'Item atualizado!', variant: 'success' as 'default' })
  }

  const currentUrl = showBack ? backUrl : frontUrl

  return (
    <>
      <div
        className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm cursor-pointer"
        onClick={() => navigate(`/items/${item.id}`)}
      >
        {/* Imagem com flip */}
        <div className="aspect-square bg-muted relative overflow-hidden group">
          <AnimatePresence mode="wait">
            <motion.div
              key={showBack ? 'back' : 'front'}
              initial={{ opacity: 0, rotateY: isFlipping ? 90 : 0 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full"
            >
              {currentUrl ? (
                <img
                  src={currentUrl}
                  alt={showBack ? 'Verso' : 'Frente'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {item.type === 'coin' ? (
                    <Coins className="h-12 w-12 text-muted-foreground/40" />
                  ) : (
                    <FileText className="h-12 w-12 text-muted-foreground/40" />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <Badge className="text-[10px] px-1.5 py-0.5">
              {getItemLabel(item.type)}
            </Badge>
            {item.available_for_trade && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 flex items-center gap-0.5">
                <ArrowLeftRight className="h-2.5 w-2.5" />
                Troca
              </Badge>
            )}
          </div>

          {/* Botão flip */}
          {backUrl && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleFlip() }}
              className="absolute bottom-2 right-2 bg-background/80 rounded-full p-1.5 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          {backUrl && (
            <span className="absolute bottom-2 left-2 text-[10px] bg-background/70 rounded-full px-2 py-0.5 backdrop-blur-sm text-muted-foreground">
              {showBack ? 'Verso' : 'Frente'}
            </span>
          )}
        </div>

        {/* Informações */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{item.country}</p>
              <p className="text-xs text-muted-foreground">
                {item.year && <span>{item.year}</span>}
                {item.denomination && item.currency && (
                  <span className="ml-1">{formatCurrency(item.denomination, item.currency)}</span>
                )}
              </p>
              {item.commemorative_edition && (
                <p className="text-[11px] text-primary truncate mt-0.5">{item.commemorative_edition}</p>
              )}
            </div>
            {item.quantity > 1 && (
              <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium shrink-0">
                x{item.quantity}
              </span>
            )}
          </div>

          {/* Botões de ação para o dono */}
          {isOwner && (
            <div
              className="flex gap-2 mt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs gap-1"
                onClick={(e) => { e.stopPropagation(); setShowEditModal(true) }}
              >
                <Edit className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs gap-1 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de edição */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
          </DialogHeader>
          <ItemForm
            item={item}
            onSuccess={handleUpdated}
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
              Tem certeza que deseja excluir esta {getItemLabel(item.type).toLowerCase()}? Esta ação não pode ser desfeita.
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
    </>
  )
}
