import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sun, Moon, Coins, MessageCircle, LogOut, User, Shield } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { api } from '../../lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { getInitials, getImageUrl } from '../../lib/utils'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
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
    }, 60000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md pt-safe">
      <div className="max-w-lg mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/feed" className="flex items-center gap-2">
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Coins className="h-7 w-7 text-primary" />
          </motion.div>
          <span className="text-xl font-bold text-foreground">
            Coin<span className="text-primary">Hub</span>
          </span>
        </Link>

        {/* Ações */}
        <div className="flex items-center gap-2">
          {/* Toggle tema */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {isAuthenticated ? (
            <>
              {/* Badge de mensagens */}
              <Link to="/messages" className="relative">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MessageCircle className="h-4 w-4" />
                </Button>
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Link>

              {/* Menu do usuário */}
              <DropdownMenuPrimitive.Root>
                <DropdownMenuPrimitive.Trigger asChild>
                  <button className="outline-none">
                    <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-primary/30 hover:ring-primary transition-all">
                      <AvatarImage
                        src={getImageUrl(user?.avatar_url) ?? undefined}
                        alt={user?.name}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(user?.name ?? '')}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuPrimitive.Trigger>

                <DropdownMenuPrimitive.Portal>
                  <DropdownMenuPrimitive.Content
                    sideOffset={8}
                    align="end"
                    className="z-50 min-w-[180px] overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
                  >
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-semibold truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>

                    <DropdownMenuPrimitive.Item asChild>
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-accent outline-none"
                      >
                        <User className="h-4 w-4" />
                        Meu Perfil
                      </Link>
                    </DropdownMenuPrimitive.Item>

                    {isAdmin && (
                      <DropdownMenuPrimitive.Item asChild>
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-accent outline-none"
                        >
                          <Shield className="h-4 w-4" />
                          Administração
                        </Link>
                      </DropdownMenuPrimitive.Item>
                    )}

                    <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />

                    <DropdownMenuPrimitive.Item
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-destructive/10 text-destructive outline-none"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </DropdownMenuPrimitive.Item>
                  </DropdownMenuPrimitive.Content>
                </DropdownMenuPrimitive.Portal>
              </DropdownMenuPrimitive.Root>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Entrar</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Registrar</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
