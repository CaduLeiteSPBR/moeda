import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { useToast } from '../../hooks/use-toast'
import { cn } from '../../lib/utils'

interface InterestButtonProps {
  itemId: string
  isInterested: boolean
  onToggle?: (interested: boolean) => void
}

export default function InterestButton({ itemId, isInterested: initialInterested, onToggle }: InterestButtonProps) {
  const { toast } = useToast()
  const [isInterested, setIsInterested] = useState(initialInterested)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      const res = await api.items.toggleInterest(itemId)
      setIsInterested(res.interested)
      onToggle?.(res.interested)
      setShowConfirm(false)
      toast({
        title: res.interested
          ? 'Interesse registrado!'
          : 'Interesse removido',
        description: res.interested
          ? 'O proprietário foi notificado pelo interesse.'
          : undefined,
        variant: 'success' as 'default',
      })
    } catch (err: unknown) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        animate={isInterested ? { scale: [1, 1.2, 1] } : {}}
        onClick={() => setShowConfirm(true)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all',
          isInterested
            ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
            : 'bg-background border-border text-foreground hover:bg-accent'
        )}
      >
        <Heart
          className={cn(
            'h-4 w-4 transition-all',
            isInterested ? 'fill-current' : ''
          )}
        />
        {isInterested ? 'Com interesse' : 'Tenho Interesse'}
      </motion.button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isInterested ? 'Remover interesse?' : 'Demonstrar interesse?'}
            </DialogTitle>
            <DialogDescription>
              {isInterested
                ? 'Deseja remover o interesse neste item?'
                : 'Deseja demonstrar interesse neste item? Uma mensagem será enviada ao proprietário.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
