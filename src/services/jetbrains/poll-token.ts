import { JETBRAINS_OAUTH } from "~/lib/api-config.js"
import { sleep } from "~/lib/utils.js"

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  scope?: string
  id_token?: string
}

interface TokenErrorResponse {
  error: string
  error_description?: string
}

export async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<TokenResponse> {
  const deadline = Date.now() + expiresIn * 1000

  while (Date.now() < deadline) {
    await sleep(interval * 1000)

    const response = await fetch(JETBRAINS_OAUTH.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
      }),
    })

    if (response.ok) {
      return response.json()
    }

    const error: TokenErrorResponse = await response.json()

    if (error.error === "authorization_pending") {
      continue
    }

    if (error.error === "slow_down") {
      interval += 5
      continue
    }

    throw new Error(`Token polling failed: ${error.error} - ${error.error_description ?? ""}`)
  }

  throw new Error("Device code expired. Please try again.")
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(JETBRAINS_OAUTH.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to refresh token: ${response.status} ${text}`)
  }

  return response.json()
}
