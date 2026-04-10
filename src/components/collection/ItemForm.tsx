import React, { useState } from 'react'
import { Loader2, Sparkles, ScanSearch } from 'lucide-react'
import { Item, ItemFormData, api } from '../../lib/api'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import ImageUpload from './ImageUpload'
import { useToast } from '../../hooks/use-toast'

interface ItemFormProps {
  item?: Item
  onSuccess: (item: Item) => void
  onCancel: () => void
}

const CURRENCIES = [
  { value: 'BRL', label: 'Real (R$)' },
  { value: 'USD', label: 'Dólar (US$)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'Libra (£)' },
  { value: 'ARS', label: 'Peso Argentino' },
  { value: 'UYU', label: 'Peso Uruguaio' },
  { value: 'PYG', label: 'Guarani (₲)' },
  { value: 'CLP', label: 'Peso Chileno' },
  { value: 'COP', label: 'Peso Colombiano' },
  { value: 'PEN', label: 'Sol Peruano' },
  { value: 'MXN', label: 'Peso Mexicano' },
  { value: 'OTHER', label: 'Outro' },
]

export default function ItemForm({ item, onSuccess, onCancel }: ItemFormProps) {
  const { toast } = useToast()
  const isEditing = !!item

  const [form, setForm] = useState({
    type: item?.type || 'coin' as 'coin' | 'note',
    country: item?.country || '',
    year: item?.year?.toString() || '',
    denomination: item?.denomination?.toString() || '',
    currency: item?.currency || 'BRL',
    quantity: item?.quantity?.toString() || '1',
    available_for_trade: item?.available_for_trade ?? false,
    commemorative_edition: item?.commemorative_edition || '',
    description: item?.description || '',
    front_image_url: item?.front_image_url || null as string | null,
    back_image_url: item?.back_image_url || null as string | null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false)
  const [identified, setIdentified] = useState(false)

  const handleChange = (field: string, value: string | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ─── Gerar descrição com IA ──────────────────────────────────────────────
  // Aceita valores diretos para ser chamada logo após a identificação,
  // antes que o React atualize o estado do formulário.

  const handleGenerateDescription = async (overrides?: {
    type?: 'coin' | 'note'
    country?: string
    year?: string
    denomination?: string
    currency?: string
    commemorative_edition?: string
  }) => {
    const values = overrides ? { ...form, ...overrides } : form
    setIsGeneratingDesc(true)
    try {
      const res = await api.ai.describe({
        type: values.type,
        country: values.country || undefined,
        year: values.year ? parseInt(values.year) : undefined,
        denomination: values.denomination ? parseFloat(values.denomination) : undefined,
        currency: values.currency || undefined,
        commemorative_edition: values.commemorative_edition || undefined,
      })
      handleChange('description', res.description)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao gerar descrição',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingDesc(false)
    }
  }

  // ─── Identificar item pela imagem ─────────────────────────────────────────

  const handleIdentify = async () => {
    if (!form.front_image_url) return
    setIsIdentifying(true)
    setIdentified(false)
    try {
      const result = await api.ai.identify(form.front_image_url)

      const identified = {
        type: (result.type === 'coin' || result.type === 'note') ? result.type : form.type,
        country: result.country || form.country,
        year: result.year ? String(result.year) : form.year,
        denomination: result.denomination ? String(result.denomination) : form.denomination,
        currency: result.currency || form.currency,
        commemorative_edition: result.commemorative_edition || form.commemorative_edition,
      }

      setForm((prev) => ({ ...prev, ...identified }))
      setIdentified(true)

      toast({
        title: 'Item identificado! Gerando descrição...',
        description: 'Verifique o valor e o ano antes de salvar.',
        variant: 'default',
        duration: 5000,
      })

      // Gera descrição automaticamente passando os valores identificados diretamente
      await handleGenerateDescription(identified)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const isPartial = msg.startsWith('Identificado como:')
      toast({
        title: isPartial ? 'Identificação parcial' : 'Não foi possível identificar',
        description: msg || 'Tente com uma foto mais nítida ou preencha manualmente.',
        variant: isPartial ? 'default' : 'destructive',
        duration: 8000,
      })
    } finally {
      setIsIdentifying(false)
    }
  }

  // ─── Submeter formulário ──────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.country) {
      toast({ title: 'Informe o país', variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      const data: ItemFormData = {
        type: form.type,
        country: form.country,
        year: form.year ? parseInt(form.year) : undefined,
        denomination: form.denomination ? parseFloat(form.denomination) : undefined,
        currency: form.currency || undefined,
        quantity: form.quantity ? parseInt(form.quantity) : 1,
        available_for_trade: form.available_for_trade,
        commemorative_edition: form.commemorative_edition || undefined,
        description: form.description || undefined,
        front_image_url: form.front_image_url || undefined,
        back_image_url: form.back_image_url || undefined,
      }

      let result: Item
      if (isEditing && item) {
        result = await api.items.update(item.id, data)
      } else {
        result = await api.items.create(data)
      }
      onSuccess(result)
    } catch (err: unknown) {
      toast({
        title: `Erro ao ${isEditing ? 'atualizar' : 'criar'} item`,
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── 1. Imagens ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <ImageUpload
            label="Frente *"
            value={form.front_image_url}
            onChange={(key) => {
              handleChange('front_image_url', key)
              if (!key) setIdentified(false)
            }}
          />
          <ImageUpload
            label="Verso"
            value={form.back_image_url}
            onChange={(key) => handleChange('back_image_url', key)}
          />
        </div>

        {/* Botão Identificar com IA */}
        <Button
          type="button"
          variant={identified ? 'secondary' : 'default'}
          className="w-full gap-2"
          onClick={handleIdentify}
          disabled={!form.front_image_url || isIdentifying}
        >
          {isIdentifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanSearch className="h-4 w-4" />
          )}
          {isIdentifying
            ? 'Identificando...'
            : identified
            ? 'Identificado! Clique para re-identificar'
            : 'Identificar com IA'}
        </Button>

        {!form.front_image_url && (
          <p className="text-xs text-muted-foreground text-center">
            Envie a foto da frente para usar a identificação automática
          </p>
        )}
      </div>

      {/* ── Divisor ────────────────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">Informações do item</span>
        </div>
      </div>

      {/* ── 2. Tipo ────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>Tipo *</Label>
        <Select
          value={form.type}
          onValueChange={(v) => handleChange('type', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="coin">Moeda</SelectItem>
            <SelectItem value="note">Cédula</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── 3. País ────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="country">País *</Label>
        <Input
          id="country"
          placeholder="Ex: Brasil"
          value={form.country}
          onChange={(e) => handleChange('country', e.target.value)}
          required
        />
      </div>

      {/* ── 4. Ano e Valor ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="year">Ano</Label>
          <Input
            id="year"
            type="number"
            placeholder="Ex: 2023"
            value={form.year}
            onChange={(e) => handleChange('year', e.target.value)}
            min="1"
            max="2100"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="denomination">Valor</Label>
          <Input
            id="denomination"
            type="number"
            step="0.01"
            placeholder="Ex: 1.00"
            value={form.denomination}
            onChange={(e) => handleChange('denomination', e.target.value)}
          />
        </div>
      </div>

      {/* ── 5. Moeda ───────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label>Moeda</Label>
        <Select
          value={form.currency}
          onValueChange={(v) => handleChange('currency', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── 6. Quantidade ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="quantity">Quantidade</Label>
        <Input
          id="quantity"
          type="number"
          min="1"
          value={form.quantity}
          onChange={(e) => handleChange('quantity', e.target.value)}
        />
      </div>

      {/* ── 7. Edição comemorativa ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="commemorative">Edição Comemorativa</Label>
        <Input
          id="commemorative"
          placeholder="Ex: Copa do Mundo 2014"
          value={form.commemorative_edition}
          onChange={(e) => handleChange('commemorative_edition', e.target.value)}
        />
      </div>

      {/* ── 8. Disponível para troca ───────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-medium">Disponível para troca</p>
          <p className="text-xs text-muted-foreground">Outros podem demonstrar interesse</p>
        </div>
        <Switch
          checked={form.available_for_trade}
          onCheckedChange={(v) => handleChange('available_for_trade', v)}
        />
      </div>

      {/* ── 9. Descrição com IA ────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Descrição</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleGenerateDescription()}
            disabled={isGeneratingDesc}
            className="h-7 text-xs gap-1.5 text-primary"
          >
            {isGeneratingDesc ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {isGeneratingDesc ? 'Gerando...' : 'Gerar com IA'}
          </Button>
        </div>
        <Textarea
          id="description"
          placeholder="Descreva o item (estado de conservação, raridade, etc.)"
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
        />
      </div>

      {/* ── Ações ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {isEditing ? 'Salvando...' : 'Adicionando...'}</>
          ) : (
            isEditing ? 'Salvar' : 'Adicionar'
          )}
        </Button>
      </div>
    </form>
  )
}
