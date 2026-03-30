import { JETBRAINS_OAUTH } from "~/lib/api-config.js"

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  scope?: string
  id_token?: string
}

/**
 * Exchange an authorization code for tokens using PKCE.
 */
export async function exchangeCodeForToken(params: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.codeVerifier,
    client_id: JETBRAINS_OAUTH.clientId,
    redirect_uri: params.redirectUri,
  })

  const response = await fetch(JETBRAINS_OAUTH.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${text}`)
  }

  return response.json()
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: JETBRAINS_OAUTH.clientId,
  })

  const response = await fetch(JETBRAINS_OAUTH.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to refresh token: ${response.status} ${text}`)
  }

  return response.json()
}
