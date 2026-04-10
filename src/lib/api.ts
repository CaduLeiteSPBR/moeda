const BASE_URL = '/api'
const TOKEN_KEY = 'coinhub_token'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  city: string | null
  avatar_url: string | null
  is_admin: boolean
  is_verified?: boolean
  followers_count?: number
  following_count?: number
  items_count?: number
  created_at?: string | number
  whatsapp?: string | null
  birth_date?: string | null
}

export interface Item {
  id: string
  user_id: string
  type: 'coin' | 'note'
  country: string
  year: number | null
  denomination: number | null
  currency: string | null
  quantity: number
  available_for_trade: boolean
  commemorative_edition: string | null
  description: string | null
  front_image_url: string | null
  back_image_url: string | null
  created_at: string | number
  updated_at?: string | number
  owner_name?: string
  owner_city?: string | null
  owner_avatar_url?: string | null
  user?: User
  is_interested?: boolean
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  item_id: string | null
  is_read: boolean
  created_at: string | number
  sender?: User
  receiver?: User
  item?: Item
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface RegisterData {
  name: string
  email: string
  password: string
  city?: string
  birth_date?: string
  whatsapp?: string
}

export interface LoginData {
  email: string
  password: string
}

export interface ItemFormData {
  type: 'coin' | 'note'
  country: string
  year?: number
  denomination?: number
  currency?: string
  quantity?: number
  available_for_trade?: boolean
  commemorative_edition?: string
  description?: string
  front_image_url?: string
  back_image_url?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function authHeadersNoContent(): Record<string, string> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Erro ${res.status}`
    try {
      const body = await res.json()
      message = body.error || body.message || message
    } catch {
      // ignora erro de parse
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  )
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (data: RegisterData) =>
      fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<{ message: string }>),

    login: (data: LoginData) =>
      fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<{ token: string; user: User }>),

    verifyEmail: (token: string) =>
      fetch(`${BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token }),
      }).then(handleResponse<{ message: string }>),

    forgotPassword: (email: string) =>
      fetch(`${BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email }),
      }).then(handleResponse<{ message: string }>),

    resetPassword: (token: string, password: string) =>
      fetch(`${BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token, password }),
      }).then(handleResponse<{ message: string }>),

    resendVerification: (email: string) =>
      fetch(`${BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email }),
      }).then(handleResponse<{ message: string }>),

    googleUrl: () => `${BASE_URL}/auth/google`,
  },

  users: {
    me: () =>
      fetch(`${BASE_URL}/users/me`, {
        headers: authHeaders(),
      }).then(handleResponse<User>),

    updateMe: (data: Partial<User & { whatsapp?: string; birth_date?: string }>) =>
      fetch(`${BASE_URL}/users/me`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<User>),

    updatePassword: (data: { current_password: string; new_password: string }) =>
      fetch(`${BASE_URL}/users/me/password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<{ message: string }>),

    getById: (id: string) =>
      fetch(`${BASE_URL}/users/${id}`, {
        headers: authHeaders(),
      }).then(handleResponse<User>),

    search: (q: string, page = 1) =>
      fetch(`${BASE_URL}/users/search${buildQuery({ q, page })}`, {
        headers: authHeaders(),
      }).then(handleResponse<PaginatedResponse<User>>),

    follow: (id: string) =>
      fetch(`${BASE_URL}/users/${id}/follow`, {
        method: 'POST',
        headers: authHeaders(),
      }).then(handleResponse<{ message: string }>),

    unfollow: (id: string) =>
      fetch(`${BASE_URL}/users/${id}/follow`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).then(handleResponse<{ message: string }>),
  },

  items: {
    list: (params: {
      page?: number
      limit?: number
      type?: string
      user_id?: string
      available_for_trade?: boolean
      q?: string
      country?: string
    } = {}) =>
      fetch(`${BASE_URL}/items${buildQuery(params as Record<string, string | number | boolean | undefined | null>)}`, {
        headers: authHeaders(),
      }).then(handleResponse<PaginatedResponse<Item>>),

    getById: (id: string) =>
      fetch(`${BASE_URL}/items/${id}`, {
        headers: authHeaders(),
      }).then(handleResponse<{ item: Item }>).then((r) => r.item),

    create: (data: ItemFormData) =>
      fetch(`${BASE_URL}/items`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<{ item: Item }>).then((r) => r.item),

    update: (id: string, data: Partial<ItemFormData>) =>
      fetch(`${BASE_URL}/items/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<{ item: Item }>).then((r) => r.item),

    delete: (id: string) =>
      fetch(`${BASE_URL}/items/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      }).then(handleResponse<{ message: string }>),

    toggleInterest: (id: string) =>
      fetch(`${BASE_URL}/items/${id}/interest`, {
        method: 'POST',
        headers: authHeaders(),
      }).then(handleResponse<{ message: string; interested: boolean }>),
  },

  feed: {
    get: (type: 'all' | 'following' = 'all', page = 1) =>
      fetch(`${BASE_URL}/feed${buildQuery({ type, page })}`, {
        headers: authHeaders(),
      }).then(handleResponse<PaginatedResponse<Item>>),
  },

  messages: {
    inbox: (page = 1) =>
      fetch(`${BASE_URL}/messages${buildQuery({ page })}`, {
        headers: authHeaders(),
      }).then(handleResponse<PaginatedResponse<Message>>),

    sent: (page = 1) =>
      fetch(`${BASE_URL}/messages/sent${buildQuery({ page })}`, {
        headers: authHeaders(),
      }).then(handleResponse<PaginatedResponse<Message>>),

    unreadCount: () =>
      fetch(`${BASE_URL}/messages/unread-count`, {
        headers: authHeaders(),
      }).then(handleResponse<{ count: number }>),

    send: (data: { receiver_id: string; content: string; item_id?: string }) =>
      fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<Message>),

    markRead: (id: string) =>
      fetch(`${BASE_URL}/messages/${id}/read`, {
        method: 'PUT',
        headers: authHeaders(),
      }).then(handleResponse<{ message: string }>),

    adminAll: (page = 1) =>
      fetch(`${BASE_URL}/messages/admin/all${buildQuery({ page })}`, {
        headers: authHeaders(),
      }).then(handleResponse<PaginatedResponse<Message>>),
  },

  upload: {
    image: async (file: File): Promise<{ key: string; url: string }> => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers: authHeadersNoContent(),
        body: formData,
      })
      return handleResponse<{ key: string; url: string }>(res)
    },
  },

  ai: {
    describe: (data: {
      type?: string
      country?: string
      year?: number
      denomination?: number
      currency?: string
      commemorative_edition?: string
    }) =>
      fetch(`${BASE_URL}/ai/describe`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<{ description: string }>),
  },

  admin: {
    users: (params: { page?: number; q?: string } = {}) =>
      fetch(`${BASE_URL}/admin/users${buildQuery(params)}`, {
        headers: authHeaders(),
      }).then(handleResponse<PaginatedResponse<User>>),

    resetPassword: (userId: string, newPassword: string) =>
      fetch(`${BASE_URL}/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ new_password: newPassword }),
      }).then(handleResponse<{ message: string }>),
  },
}
