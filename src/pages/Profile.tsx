import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2, Save, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/use-toast'
import { api } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import { getInitials, getImageUrl, formatDate } from '../lib/utils'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    city: user?.city || '',
    birth_date: '',
    whatsapp: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      const updated = await api.users.updateMe({
        name: profileForm.name,
        city: profileForm.city,
        ...(profileForm.birth_date && { birth_date: profileForm.birth_date }),
        ...(profileForm.whatsapp && { whatsapp: profileForm.whatsapp }),
      })
      updateUser(updated)
      toast({ title: 'Perfil atualizado!', variant: 'success' as 'default' })
    } catch (err: unknown) {
      toast({ title: 'Erro ao salvar', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' })
      return
    }
    if (passwordForm.new_password.length < 6) {
      toast({ title: 'A nova senha deve ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }
    setIsSavingPassword(true)
    try {
      await api.users.updatePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      toast({ title: 'Senha alterada com sucesso!', variant: 'success' as 'default' })
    } catch (err: unknown) {
      toast({ title: 'Erro ao alterar senha', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingAvatar(true)
    try {
      const uploadRes = await api.upload.image(file)
      const updated = await api.users.updateMe({ avatar_url: uploadRes.key })
      updateUser(updated)
      toast({ title: 'Foto atualizada!', variant: 'success' as 'default' })
    } catch (err: unknown) {
      toast({ title: 'Erro ao fazer upload', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsUploadingAvatar(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>

      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="relative">
          <Avatar className="h-24 w-24 ring-4 ring-primary/20">
            <AvatarImage src={getImageUrl(user?.avatar_url) ?? undefined} />
            <AvatarFallback className="text-2xl">
              {getInitials(user?.name ?? '')}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
            className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg hover:bg-primary/90 transition-colors"
          >
            {isUploadingAvatar ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        <div className="text-center">
          <p className="font-bold text-lg">{user?.name}</p>
          {user?.city && <p className="text-muted-foreground text-sm">{user.city}</p>}
          {user?.created_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Membro desde {formatDate(user.created_at)}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-1">
          <div className="text-center">
            <p className="font-bold text-lg">{(user as { items_count?: number })?.items_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">Itens</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{user?.followers_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">Seguidores</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{user?.following_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">Seguindo</p>
          </div>
        </div>
      </motion.div>

      <Separator />

      {/* Formulário de perfil */}
      <Card>
        <CardHeader>
          <CardTitle>Editar Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                name="name"
                value={profileForm.name}
                onChange={handleProfileChange}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                name="city"
                placeholder="Sua cidade"
                value={profileForm.city}
                onChange={handleProfileChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                value={profileForm.birth_date}
                onChange={handleProfileChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                placeholder="(00) 00000-0000"
                value={profileForm.whatsapp}
                onChange={handleProfileChange}
              />
            </div>

            <Button type="submit" className="w-full gap-2" disabled={isSavingProfile}>
              {isSavingProfile ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="h-4 w-4" /> Salvar Perfil</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Alterar senha */}
      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current_password">Senha atual</Label>
              <div className="relative">
                <Input
                  id="current_password"
                  name="current_password"
                  type={showCurrentPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new_password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  name="new_password"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirmar nova senha</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="Repita a nova senha"
                value={passwordForm.confirm_password}
                onChange={handlePasswordChange}
                required
              />
            </div>

            <Button type="submit" variant="outline" className="w-full gap-2" disabled={isSavingPassword}>
              {isSavingPassword ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
