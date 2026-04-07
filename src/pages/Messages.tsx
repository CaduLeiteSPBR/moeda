import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, MessageCircle, Eye, Reply } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api, Message } from '../lib/api'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Skeleton } from '../components/ui/skeleton'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'
import { cn, getInitials, getImageUrl, formatRelativeDate, truncate } from '../lib/utils'

function MessageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-2xl border border-border">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface MessageItemProps {
  message: Message
  type: 'inbox' | 'sent'
  onRead: (id: string) => void
  onReply: (message: Message) => void
  onView: (message: Message) => void
}

function MessageItem({ message, type, onRead, onReply, onView }: MessageItemProps) {
  const otherUser = type === 'inbox' ? message.sender : message.receiver
  const isUnread = type === 'inbox' && !message.is_read

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-border p-3 transition-colors',
        isUnread ? 'bg-primary/5 border-primary/20' : 'bg-card'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={getImageUrl(otherUser?.avatar_url) ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(otherUser?.name ?? '')}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className={cn('text-sm truncate', isUnread ? 'font-semibold' : 'font-medium')}>
                {otherUser?.name}
              </p>
              {isUnread && (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelativeDate(message.created_at)}
            </span>
          </div>

          {otherUser?.city && (
            <p className="text-xs text-muted-foreground">{otherUser.city}</p>
          )}

          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {truncate(message.content, 100)}
          </p>

          {message.item && (
            <Link
              to={`/items/${message.item.id}`}
              className="text-xs text-primary hover:underline mt-1 block"
            >
              Sobre: {message.item.country} {message.item.year}
            </Link>
          )}

          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => {
                onView(message)
                if (isUnread) onRead(message.id)
              }}
            >
              <Eye className="h-3 w-3" />
              Ver
            </Button>
            {type === 'inbox' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => onReply(message)}
              >
                <Reply className="h-3 w-3" />
                Responder
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function Messages() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [viewMessage, setViewMessage] = useState<Message | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadMessages = useCallback(async (msgTab: 'inbox' | 'sent', p: number, append = false) => {
    if (p === 1) setIsLoading(true)
    else setLoadingMore(true)
    try {
      const res = msgTab === 'inbox'
        ? await api.messages.inbox(p)
        : await api.messages.sent(p)

      if (append) {
        setMessages((prev) => [...prev, ...res.data])
      } else {
        setMessages(res.data)
      }
      setHasMore(p < res.pagination.totalPages)
      setPage(p)

      // Atualiza contagem
      if (msgTab === 'inbox') {
        const unread = res.data.filter((m: Message) => !m.is_read).length
        setUnreadCount(unread)
      }
    } catch (err: unknown) {
      toast({ title: 'Erro ao carregar mensagens', variant: 'destructive' })
    } finally {
      setIsLoading(false)
      setLoadingMore(false)
    }
  }, [toast])

  useEffect(() => {
    loadMessages(tab, 1, false)
  }, [tab, loadMessages])

  const handleMarkRead = async (id: string) => {
    try {
      await api.messages.markRead(id)
      setMessages((prev) =>
        prev.map((m) => m.id === id ? { ...m, is_read: true } : m)
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silencia erro
    }
  }

  const handleSendReply = async () => {
    if (!replyTo || !replyContent.trim()) return
    const receiverId = replyTo.sender_id === user?.id ? replyTo.receiver_id : replyTo.sender_id
    setIsSending(true)
    try {
      await api.messages.send({
        receiver_id: receiverId,
        content: replyContent.trim(),
        item_id: replyTo.item_id ?? undefined,
      })
      setReplyContent('')
      setReplyTo(null)
      toast({ title: 'Mensagem enviada!', variant: 'success' as 'default' })
      if (tab === 'sent') loadMessages('sent', 1, false)
    } catch (err: unknown) {
      toast({ title: 'Erro ao enviar', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Mensagens
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'inbox' | 'sent')}>
        <TabsList className="w-full">
          <TabsTrigger value="inbox" className="flex-1">
            Recebidas
            {unreadCount > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1">Enviadas</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          {isLoading ? (
            <MessageSkeleton />
          ) : messages.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma mensagem recebida</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  type="inbox"
                  onRead={handleMarkRead}
                  onReply={(m) => { setReplyTo(m); setViewMessage(null) }}
                  onView={setViewMessage}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          {isLoading ? (
            <MessageSkeleton />
          ) : messages.length === 0 ? (
            <div className="text-center py-16">
              <Send className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma mensagem enviada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  type="sent"
                  onRead={handleMarkRead}
                  onReply={(m) => setReplyTo(m)}
                  onView={setViewMessage}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {hasMore && !isLoading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => loadMessages(tab, page + 1, true)} disabled={loadingMore}>
            {loadingMore ? <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</> : 'Carregar mais'}
          </Button>
        </div>
      )}

      {/* Modal de visualização */}
      <Dialog open={!!viewMessage} onOpenChange={(o) => !o && setViewMessage(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mensagem</DialogTitle>
          </DialogHeader>
          {viewMessage && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getImageUrl(
                    tab === 'inbox' ? viewMessage.sender?.avatar_url : viewMessage.receiver?.avatar_url
                  ) ?? undefined} />
                  <AvatarFallback>
                    {getInitials(
                      tab === 'inbox' ? (viewMessage.sender?.name ?? '') : (viewMessage.receiver?.name ?? '')
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {tab === 'inbox' ? viewMessage.sender?.name : viewMessage.receiver?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeDate(viewMessage.created_at)}
                  </p>
                </div>
              </div>

              {viewMessage.item && (
                <Link
                  to={`/items/${viewMessage.item.id}`}
                  className="block text-xs text-primary bg-primary/5 rounded-lg px-3 py-2 hover:bg-primary/10"
                >
                  Item relacionado: {viewMessage.item.country} {viewMessage.item.year}
                </Link>
              )}

              <div className="bg-muted rounded-xl p-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewMessage.content}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewMessage(null)}>
              Fechar
            </Button>
            {tab === 'inbox' && viewMessage && (
              <Button onClick={() => { setReplyTo(viewMessage); setViewMessage(null) }} className="gap-2">
                <Reply className="h-4 w-4" />
                Responder
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de resposta */}
      <Dialog open={!!replyTo} onOpenChange={(o) => !o && setReplyTo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Responder mensagem</DialogTitle>
          </DialogHeader>
          {replyTo && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Para: <strong>{replyTo.sender?.name ?? replyTo.receiver?.name}</strong>
              </p>
              <div>
                <Label htmlFor="replyContent">Mensagem</Label>
                <Textarea
                  id="replyContent"
                  placeholder="Escreva sua resposta..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={4}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReplyTo(null); setReplyContent('') }} disabled={isSending}>
              Cancelar
            </Button>
            <Button onClick={handleSendReply} disabled={isSending || !replyContent.trim()}>
              {isSending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
