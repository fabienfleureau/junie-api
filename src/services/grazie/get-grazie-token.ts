import { GRAZIE_API } from "~/lib/api-config.js"

export interface GrazieTokenResponse {
  token: string
  expiresAt?: number
}

/**
 * Exchange a JetBrains auth token (OAuth JWT or API key) for a Grazie API token.
 * The Grazie auth service validates the JetBrains token and returns a token
 * that can be used to call the Grazie LLM API.
 */
export async function getGrazieToken(authToken: string): Promise<GrazieTokenResponse> {
  const response = await fetch(`${GRAZIE_API.authUrl}/v5/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to get Grazie token: ${response.status} ${text}`)
  }

  return response.json()
}
