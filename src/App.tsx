import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAuth } from './hooks/useAuth'
import { Toaster } from './components/ui/toaster'
import Layout from './components/layout/Layout'
import { Coins, Loader2 } from 'lucide-react'

// Lazy imports
const SplashScreen = lazy(() => import('./pages/SplashScreen'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const Feed = lazy(() => import('./pages/Feed'))
const Search = lazy(() => import('./pages/Search'))
const ItemDetail = lazy(() => import('./pages/ItemDetail'))
const UserProfile = lazy(() => import('./pages/UserProfile'))
const UserCollection = lazy(() => import('./pages/UserCollection'))
const MyCollection = lazy(() => import('./pages/MyCollection'))
const Messages = lazy(() => import('./pages/Messages'))
const Profile = lazy(() => import('./pages/Profile'))
const Admin = lazy(() => import('./pages/Admin'))

// Componente de loading
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="relative">
        <Coins className="h-10 w-10 text-primary/30" />
        <Loader2 className="h-10 w-10 text-primary animate-spin absolute inset-0" />
      </div>
      <p className="text-muted-foreground text-sm animate-pulse">Carregando...</p>
    </div>
  )
}

// Rota privada
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <PageLoader />
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: window.location.pathname }} replace />
  }
  return <>{children}</>
}

// Rota de admin
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  if (isLoading) return <PageLoader />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (!isAdmin) {
    return <Navigate to="/feed" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/splash" element={<SplashScreen />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route element={<Layout />}>
          {/* Rotas públicas */}
          <Route path="/feed" element={<Feed />} />
          <Route path="/search" element={<Search />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/users/:id" element={<UserProfile />} />
          <Route path="/users/:id/collection" element={<UserCollection />} />

          {/* Rotas privadas */}
          <Route
            path="/collection"
            element={
              <PrivateRoute>
                <MyCollection />
              </PrivateRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <PrivateRoute>
                <Messages />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  )
}
