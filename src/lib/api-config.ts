// JetBrains OAuth endpoints
export const JETBRAINS_OAUTH = {
  issuer: "https://oauth.account.jetbrains.com/",
  authorizationEndpoint: "https://oauth.account.jetbrains.com/api/rest/oauth2/auth",
  tokenEndpoint: "https://oauth.account.jetbrains.com/api/rest/oauth2/token",
  deviceAuthorizationEndpoint: "https://oauth.account.jetbrains.com/api/rest/oauth2/device-auth",
  userinfoEndpoint: "https://oauth.account.jetbrains.com/api/rest/oauth2/userinfo",
  permanentTokensEndpoint: "https://oauth.account.jetbrains.com/api/rest/users/me/permanenttokens",
  scopes: "offline_access openid jb-authn-service",
} as const

// Grazie API (JetBrains AI Platform)
export const GRAZIE_API = {
  baseUrl: "https://api.jetbrains.ai",
  authUrl: "https://auth.grazie.ai",
  chatCompletionsPath: "/v5/llm/openai/v1/chat/completions",
  modelsPath: "/v5/llm/openai/v1/models",
} as const

export function getGrazieHeaders(token: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  }
}
