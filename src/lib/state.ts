export interface State {
  // JetBrains auth token (JWT from OAuth flow or API key)
  authToken?: string
  // Grazie API token (obtained from auth.grazie.ai)
  grazieToken?: string
  // Refresh token for JetBrains OAuth
  refreshToken?: string
  // Available models
  models?: Array<{ id: string; name: string }>
  // Configuration
  verbose: boolean
  showToken: boolean
  rateLimitSeconds?: number
  rateLimitWait: boolean
  lastRequestTimestamp?: number
}

export const state: State = {
  verbose: false,
  showToken: false,
  rateLimitWait: false,
}
