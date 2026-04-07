export type Env = {
  DB: D1Database
  R2: R2Bucket
  AI: Ai
  JWT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  RESEND_API_KEY: string
  FRONTEND_URL: string
  GOOGLE_REDIRECT_URI: string
  ADMIN_EMAIL: string
}

export type DbUser = {
  id: string
  name: string
  email: string
  city: string
  avatar_url: string | null
  is_admin: number
  email_verified: number
}

export type Variables = {
  user: DbUser | null
}

export type AppContext = {
  Bindings: Env
  Variables: Variables
}
