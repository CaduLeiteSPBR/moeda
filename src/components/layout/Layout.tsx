import React from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Header from './Header'
import BottomNav from './BottomNav'
import { cn } from '../../lib/utils'

export default function Layout() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className={cn('flex', isAuthenticated ? 'sm:pl-56' : '')}>
        <main
          className={cn(
            'flex-1 w-full max-w-lg mx-auto px-4 pt-4',
            isAuthenticated ? 'pb-24 sm:pb-8' : 'pb-8'
          )}
        >
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
