import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coins, FileText, MapPin, ArrowLeftRight, User } from 'lucide-react'
import { Item } from '../../lib/api'
import { Badge } from '../ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { cn, getInitials, getImageUrl, getItemLabel, formatCurrency } from '../../lib/utils'

interface FeedCardProps {
  item: Item
  index?: number
}

export default function FeedCard({ item, index = 0 }: FeedCardProps) {
  const navigate = useNavigate()
  const imageUrl = getImageUrl(item.front_image_key)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={() => navigate(`/items/${item.id}`)}
      className="cursor-pointer rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Imagem */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${item.country} ${item.year}`}
            className="w-full h-full object-cover"
            loading="lazy"
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

        {/* Badges sobrepostos */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Badge className="text-[10px] px-1.5 py-0.5 shadow-sm">
            {getItemLabel(item.type)}
          </Badge>
          {item.available_for_trade && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shadow-sm flex items-center gap-0.5">
              <ArrowLeftRight className="h-2.5 w-2.5" />
              Troca
            </Badge>
          )}
        </div>
      </div>

      {/* Informações */}
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{item.country}</p>
            <p className="text-xs text-muted-foreground">
              {item.year && item.year}
              {item.denomination && item.currency && (
                <span className="ml-1">{formatCurrency(item.denomination, item.currency)}</span>
              )}
            </p>
          </div>
        </div>

        {/* Usuário */}
        {item.user && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
            <Avatar className="h-5 w-5">
              <AvatarImage src={getImageUrl(item.user.avatar_url) ?? undefined} />
              <AvatarFallback className="text-[8px]">
                {getInitials(item.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium truncate">{item.user.name}</p>
              {item.user.city && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {item.user.city}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
