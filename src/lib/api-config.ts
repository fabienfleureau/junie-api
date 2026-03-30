// JetBrains OAuth endpoints (PKCE Authorization Code flow)
export const JETBRAINS_OAUTH = {
  // JetBrains Hub OAuth base
  jbaBaseUrl: "https://oauth.account.jetbrains.com",
  tokenEndpoint: "https://oauth.account.jetbrains.com/oauth2/token",
  userinfoEndpoint: "https://oauth.account.jetbrains.com/api/rest/oauth2/userinfo",

  // Junie web auth flow (browser-based)
  loginInitialUrl: "https://junie.jetbrains.com/cli-auth",
  postLoginUrl: "https://junie.jetbrains.com/cli-auth-complete",

  // OAuth client config
  clientId: "junie-cli",
  scopes: "offline_access openid jb-authn-service",

  // Local callback server port range
  callbackPortStart: 62345,
  callbackPortEnd: 62364,
} as const

// Grazie API Gateway (JetBrains AI Platform)
// For subscription tokens (perm-*, JBA JWT), LLM calls go through the Grazie gateway.
// Auth validation uses ingrazzio-cloud-prod, but chat uses api.jetbrains.ai.
export const GRAZIE_API = {
  // Auth validation endpoint (ingrazzio-cloud-prod)
  authBaseUrl: "https://ingrazzio-cloud-prod.labs.jb.gg",
  // LLM API gateway (Grazie native protocol)
  baseUrl: "https://api.jetbrains.ai",
  chatStreamPath: "/llm/chat/stream/v9",
} as const

// Anthropic native passthrough (discovered via MITM capture 2026-03-30)
// ingrazzio-cloud-prod supports Anthropic /v1/messages directly — no translation needed.
export const ANTHROPIC_API = {
  baseUrl: "https://ingrazzio-cloud-prod.labs.jb.gg",
  messagesPath: "/v1/messages",
} as const

export function getGrazieHeaders(token: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
  }
}

/** Headers for Anthropic native passthrough (from MITM capture of Junie CLI v888.219) */
export function getAnthropicPassthroughHeaders(token: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "text/event-stream,application/json",
    "Accept-Encoding": "identity",
    "Grazie-Agent": '{"name":"junie:cli","version":"888.219"}',
    "X-LLM-Model": "anthropic",
    "X-Free-Google-Api": "true",
    "X-Keep-Path": "true",
    "Openai-Version": "2020-11-07",
    "X-Accept-EAP-License": "false",
  }
}

/** Check if a model ID should use the Anthropic native passthrough path */
export function isAnthropicModel(modelId: string): boolean {
  return modelId.startsWith("claude-")
}
