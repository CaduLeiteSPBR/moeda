import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, Layers, MessageCircle, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/feed', icon: Home, label: 'Feed' },
  { to: '/search', icon: Search, label: 'Busca' },
  { to: '/collection', icon: Layers, label: 'Coleção' },
  { to: '/messages', icon: MessageCircle, label: 'Mensagens' },
  { to: '/profile', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) return
    api.messages.unreadCount()
      .then((r) => setUnreadCount(r.count))
      .catch(() => {})

    const interval = setInterval(() => {
      api.messages.unreadCount()
        .then((r) => setUnreadCount(r.count))
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  if (!isAuthenticated) return null

  return (
    <>
      {/* Mobile: barra inferior fixa */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-background/90 backdrop-blur-md border-t border-border pb-safe">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/feed' && location.pathname.startsWith(item.to))
            const Icon = item.icon
            const isMessages = item.to === '/messages'

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center flex-1 h-full relative"
              >
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <div className="relative">
                    <Icon
                      className={cn(
                        'h-5 w-5 transition-all',
                        isActive ? 'scale-110' : 'scale-100'
                      )}
                    />
                    {isMessages && unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className={cn('text-[10px] font-medium', isActive ? 'opacity-100' : 'opacity-60')}>
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="bottomNavIndicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    />
                  )}
                </motion.div>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Desktop: sidebar/topnav */}
      <nav className="hidden sm:flex fixed left-0 top-14 bottom-0 w-56 z-30 flex-col gap-1 p-3 border-r border-border bg-background/80 backdrop-blur-md">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to ||
            (item.to !== '/feed' && location.pathname.startsWith(item.to))
          const Icon = item.icon
          const isMessages = item.to === '/messages'

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {isMessages && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
