import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(timestamp: number | string): string {
  let date: Date
  if (typeof timestamp === 'number') {
    // Unix timestamp em segundos ou milissegundos
    date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000)
  } else {
    date = new Date(timestamp)
  }
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDatetime(timestamp: number | string): string {
  let date: Date
  if (typeof timestamp === 'number') {
    date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000)
  } else {
    date = new Date(timestamp)
  }
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeDate(timestamp: number | string): string {
  let date: Date
  if (typeof timestamp === 'number') {
    date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000)
  } else {
    date = new Date(timestamp)
  }
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'agora'
  if (diffMins < 60) return `${diffMins}min atrás`
  if (diffHours < 24) return `${diffHours}h atrás`
  if (diffDays < 7) return `${diffDays}d atrás`
  return formatDate(timestamp)
}

export function formatCurrency(value: number, currency: string): string {
  const symbols: Record<string, string> = {
    BRL: 'R$',
    USD: 'US$',
    EUR: '€',
    GBP: '£',
    ARS: 'AR$',
    UYU: 'UY$',
    PYG: '₲',
    CLP: 'CL$',
    COP: 'CO$',
    PEN: 'S/',
    BOB: 'Bs',
    VES: 'Bs.S',
    MXN: 'MX$',
  }
  const symbol = symbols[currency] || currency
  return `${symbol} ${Number(value).toFixed(2).replace('.', ',')}`
}

export function getItemLabel(type: string): string {
  return type === 'coin' ? 'Moeda' : 'Cédula'
}

export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function truncate(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function getImageUrl(key: string | null | undefined): string | null {
  if (!key) return null
  if (key.startsWith('http')) return key
  return `/api/images/${key}`
}
