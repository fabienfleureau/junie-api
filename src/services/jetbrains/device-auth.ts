import { createServer, type Server } from "node:http"
import { randomBytes, createHash } from "node:crypto"
import { JETBRAINS_OAUTH } from "~/lib/api-config.js"

export interface PKCEChallenge {
  codeVerifier: string
  codeChallenge: string
}

export function generatePKCE(): PKCEChallenge {
  const codeVerifier = randomBytes(32).toString("base64url")
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url")
  return { codeVerifier, codeChallenge }
}

export function generateState(): string {
  return randomBytes(16).toString("hex")
}

export interface CallbackResult {
  code: string
  state: string
}

/**
 * Start a local HTTP server to receive the OAuth callback.
 * Tries ports 62345-62364 (same range as Junie CLI).
 */
export async function startCallbackServer(): Promise<{
  server: Server
  port: number
  waitForCallback: () => Promise<CallbackResult>
}> {
  let resolveCallback: (result: CallbackResult) => void
  let rejectCallback: (error: Error) => void

  const callbackPromise = new Promise<CallbackResult>((resolve, reject) => {
    resolveCallback = resolve
    rejectCallback = reject
  })

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost")
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error") ?? url.searchParams.get("error_description")

    if (error) {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end("<html><body><h1>Authentication Failed</h1><p>You can close this window.</p></body></html>")
      rejectCallback(new Error(`OAuth error: ${error}`))
      return
    }

    if (code && state) {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end("<html><body><h1>Authentication Successful</h1><p>You can close this window and return to your terminal.</p></body></html>")
      resolveCallback({ code, state })
      return
    }

    res.writeHead(404)
    res.end()
  })

  // Try ports in range - listen on localhost (not 127.0.0.1) to match Junie CLI
  const port = await new Promise<number>((resolve, reject) => {
    let currentPort = JETBRAINS_OAUTH.callbackPortStart

    const tryPort = () => {
      if (currentPort > JETBRAINS_OAUTH.callbackPortEnd) {
        reject(new Error(`Cannot start OAuth callback server on any port ${JETBRAINS_OAUTH.callbackPortStart}-${JETBRAINS_OAUTH.callbackPortEnd}`))
        return
      }

      server.once("error", () => {
        currentPort++
        tryPort()
      })

      server.listen(currentPort, "localhost", () => {
        resolve(currentPort)
      })
    }

    tryPort()
  })

  return {
    server,
    port,
    waitForCallback: () => callbackPromise,
  }
}

/**
 * Build the authorization URL that the user visits in their browser.
 * This goes to junie.jetbrains.com/cli-auth which handles the full OAuth flow
 * with JetBrains Hub and redirects back to our local callback server.
 *
 * URL format matches Junie CLI:
 *   {loginInitialUrl}?client_id=...&scope=...&state=...&code_challenge=...&redirect_uri=...
 */
export function buildAuthUrl(params: {
  callbackPort: number
  codeChallenge: string
  state: string
}): string {
  const redirectUri = `http://localhost:${params.callbackPort}`
  return `${JETBRAINS_OAUTH.loginInitialUrl}?client_id=${JETBRAINS_OAUTH.clientId}&scope=${encodeURIComponent(JETBRAINS_OAUTH.scopes)}&state=${params.state}&code_challenge=${params.codeChallenge}&redirect_uri=${encodeURIComponent(redirectUri)}`
}
