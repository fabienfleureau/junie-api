import consola from "consola"
import { paths, readTokenFile, writeTokenFile } from "./paths.js"
import { state } from "./state.js"
import { refreshAccessToken } from "~/services/jetbrains/poll-token.js"

/**
 * Set up the auth token from:
 * 1. Direct CLI argument (--auth-token)
 * 2. Saved token file
 * 3. Run auth flow (handled by caller)
 */
export function setupAuthTokenFromFile(): boolean {
  const saved = readTokenFile(paths.authToken)
  if (saved) {
    state.authToken = saved
    consola.success("Loaded auth token from file")

    const savedRefresh = readTokenFile(paths.refreshToken)
    if (savedRefresh) {
      state.refreshToken = savedRefresh
    }

    if (state.showToken) {
      consola.info(`Auth token: ${saved.slice(0, 20)}...`)
    }

    return true
  }
  return false
}

export function saveAuthToken(token: string, refreshToken?: string): void {
  writeTokenFile(paths.authToken, token)
  state.authToken = token

  if (refreshToken) {
    writeTokenFile(paths.refreshToken, refreshToken)
    state.refreshToken = refreshToken
  }

  consola.success("Auth token saved")
}

/**
 * Decode JWT `exp` claim and return seconds until expiry.
 * Returns undefined if the token is not a JWT or has no `exp`.
 */
export function getJwtExpiresIn(token: string): number | undefined {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return undefined

    // Base64url decode the payload
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    while (payload.length % 4) payload += "="
    const json = Buffer.from(payload, "base64").toString("utf-8")
    const claims = JSON.parse(json)

    if (typeof claims.exp !== "number") return undefined
    return Math.max(0, claims.exp - Math.floor(Date.now() / 1000))
  } catch {
    return undefined
  }
}

/**
 * Set up automatic token refresh.
 * JetBrains OAuth tokens expire; this auto-refreshes using the refresh token.
 */
export function setupTokenRefresh(expiresIn: number): void {
  if (!state.refreshToken) {
    consola.warn("No refresh token available, token will not auto-refresh")
    return
  }

  // Refresh 60 seconds before expiry
  const refreshMs = Math.max((expiresIn - 60) * 1000, 60_000)

  consola.info(`Token refresh scheduled in ${Math.round(refreshMs / 1000)}s`)

  setInterval(async () => {
    try {
      if (!state.refreshToken) return

      consola.info("Refreshing auth token...")
      const response = await refreshAccessToken(state.refreshToken)

      state.authToken = response.access_token
      writeTokenFile(paths.authToken, response.access_token)

      if (response.refresh_token) {
        state.refreshToken = response.refresh_token
        writeTokenFile(paths.refreshToken, response.refresh_token)
      }

      consola.success("Auth token refreshed")

      if (state.showToken) {
        consola.info(`New auth token: ${response.access_token.slice(0, 20)}...`)
      }
    } catch (error) {
      consola.error("Failed to refresh token:", error)
    }
  }, refreshMs)
}
