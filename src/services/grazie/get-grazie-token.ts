import { GRAZIE_API } from "~/lib/api-config.js"

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
