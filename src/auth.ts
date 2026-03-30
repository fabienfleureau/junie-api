import { execFile } from "node:child_process"
import consola from "consola"
import {
  generatePKCE,
  generateState,
  startCallbackServer,
  buildAuthUrl,
} from "~/services/jetbrains/device-auth.js"
import { exchangeCodeForToken } from "~/services/jetbrains/poll-token.js"
import { getJetBrainsUser } from "~/services/jetbrains/get-user.js"
import { saveAuthToken, setupTokenRefresh } from "~/lib/token.js"

export async function runAuthFlow(options: {
  showToken?: boolean
}): Promise<void> {
  consola.info("Starting JetBrains authentication flow...")

  // Generate PKCE challenge and state
  const pkce = generatePKCE()
  const state = generateState()

  // Start local callback server
  const { server, port, waitForCallback } = await startCallbackServer()
  const redirectUri = `http://localhost:${port}`

  consola.info(`OAuth callback server started on port ${port}`)

  // Build authorization URL
  const authUrl = buildAuthUrl({
    callbackPort: port,
    codeChallenge: pkce.codeChallenge,
    state,
  })

  // Open browser
  consola.box(
    `Please visit the following URL to authenticate:\n\n${authUrl}\n\nWaiting for authorization...`,
  )

  // Try to open browser automatically
  try {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
    execFile(cmd, [authUrl])
  } catch {
    // User will need to open manually
  }

  try {
    // Wait for callback
    const callback = await waitForCallback()

    // Verify state
    if (callback.state !== state) {
      throw new Error("OAuth state mismatch - possible CSRF attack")
    }

    // Exchange code for token
    consola.info("Exchanging authorization code for token...")
    const tokenResponse = await exchangeCodeForToken({
      code: callback.code,
      codeVerifier: pkce.codeVerifier,
      redirectUri,
    })

    saveAuthToken(tokenResponse.access_token, tokenResponse.refresh_token)

    if (options.showToken) {
      consola.info(`Access token: ${tokenResponse.access_token}`)
    }

    // Set up auto-refresh
    if (tokenResponse.refresh_token) {
      setupTokenRefresh(tokenResponse.expires_in)
    }

    try {
      const user = await getJetBrainsUser(tokenResponse.access_token)
      consola.success(`Authenticated as: ${user.name ?? user.email ?? user.sub}`)
    } catch {
      consola.success("Authenticated successfully")
    }
  } finally {
    server.close()
  }
}
