import { GRAZIE_API } from "~/lib/api-config.js"
import { state } from "~/lib/state.js"

export interface IngrazzioAuthInfo {
  username?: string
  active?: boolean
  balanceLeft?: number
  licenseType?: string
  balanceUnit?: string
  authType?: string
}

/**
 * Validate a JBA token (OAuth JWT or perm-* permanent key) against Ingrazzio.
 * GET /auth/test returns the user's auth info and license status.
 */
export async function validateIngrazzioToken(authToken: string): Promise<IngrazzioAuthInfo> {
  const response = await fetch(`${GRAZIE_API.authBaseUrl}/auth/test`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Ingrazzio auth check failed: ${response.status} ${text}`)
  }

  return response.json()
}

/**
 * Probe the free Google API tier by calling /auth/test with X-Free-Google-Api.
 * If the probe returns 477, disables freeGoogleApi for the session.
 * Returns any extra balance/info from the free-tier response.
 */
export async function probeFreeGoogleApi(authToken: string): Promise<IngrazzioAuthInfo | null> {
  const url = `${GRAZIE_API.authBaseUrl}/auth/test`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "X-Free-Google-Api": "true",
    },
  })

  if (response.status === 477) {
    state.freeGoogleApi = false
    return null
  }

  if (!response.ok) {
    // Non-477 error — don't change state, just return null
    return null
  }

  return response.json()
}
