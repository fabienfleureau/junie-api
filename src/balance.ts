import consola from "consola"
import { state } from "./lib/state.js"
import { setupAuthTokenFromFile, saveAuthToken } from "./lib/token.js"
import { runAuthFlow } from "./auth.js"
import { validateIngrazzioToken, probeFreeGoogleApi, type IngrazzioAuthInfo } from "./services/grazie/get-grazie-token.js"
import { GRAZIE_API } from "./lib/api-config.js"
import { refreshAccessToken } from "./services/jetbrains/poll-token.js"

interface BalanceOptions {
  authToken?: string
  showToken: boolean
  verbose: boolean
}

export async function printBalance(options: BalanceOptions): Promise<void> {
  state.showToken = options.showToken
  state.verbose = options.verbose

  if (options.verbose) {
    consola.level = 5
  }

  // Setup auth token
  if (options.authToken) {
    saveAuthToken(options.authToken)
  } else if (!setupAuthTokenFromFile()) {
    await runAuthFlow({ showToken: options.showToken })
  }

  if (!state.authToken) {
    consola.error("No authentication token available. Run 'junie-api auth' first.")
    process.exit(1)
  }

  // Try to validate and print balance
  try {
    const authInfo = await fetchBalance(state.authToken, options.verbose)
    printAuthInfo(authInfo)
    await printFreeGoogleStatus(state.authToken)
    return
  } catch {
    consola.warn("Token validation failed, attempting refresh...")
  }

  // Try refresh
  if (state.refreshToken) {
    try {
      const response = await refreshAccessToken(state.refreshToken)
      saveAuthToken(response.access_token, response.refresh_token)

      const authInfo = await fetchBalance(state.authToken, options.verbose)
      printAuthInfo(authInfo)
      await printFreeGoogleStatus(state.authToken)
      return
    } catch {
      consola.warn("Token refresh failed, starting auth flow...")
    }
  }

  // Last resort: re-auth
  await runAuthFlow({ showToken: options.showToken })
  const authInfo = await fetchBalance(state.authToken!, options.verbose)
  printAuthInfo(authInfo)
  await printFreeGoogleStatus(state.authToken)
}

async function fetchBalance(token: string, verbose: boolean): Promise<IngrazzioAuthInfo> {
  if (!verbose) {
    return validateIngrazzioToken(token)
  }

  const url = `${GRAZIE_API.authBaseUrl}/auth/test`
  const headers: Record<string, string> = { "Authorization": `Bearer ${token}` }

  consola.debug(`→ GET ${url}`)
  consola.debug(`→ Headers: ${JSON.stringify(headers, null, 2)}`)

  const response = await fetch(url, { method: "GET", headers })

  consola.debug(`← ${response.status} ${response.statusText}`)
  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((v, k) => { responseHeaders[k] = v })
  consola.debug(`← Headers: ${JSON.stringify(responseHeaders, null, 2)}`)

  const body = await response.text()
  consola.debug(`← Body: ${body}`)

  if (!response.ok) {
    throw new Error(`Ingrazzio auth check failed: ${response.status} ${body}`)
  }

  return JSON.parse(body)
}

function printAuthInfo(authInfo: IngrazzioAuthInfo): void {
  if (authInfo.balanceLeft != null) {
    consola.success(`Balance: ${authInfo.balanceLeft.toFixed(2)} ${authInfo.balanceUnit ?? "USD"}`)
    consola.info(`License: ${authInfo.licenseType ?? "unknown"}`)
  } else {
    consola.info("Balance information not available for this account")
  }

  if (authInfo.username) {
    consola.info(`Account: ${authInfo.username}`)
  }
}

async function printFreeGoogleStatus(token: string): Promise<void> {
  const freeInfo = await probeFreeGoogleApi(token)
  if (state.freeGoogleApi) {
    consola.success("Free Google API: available")
    if (freeInfo?.balanceLeft != null) {
      consola.info(`  Free tier balance: ${freeInfo.balanceLeft.toFixed(2)} ${freeInfo.balanceUnit ?? "USD"}`)
    }
  } else {
    consola.warn("Free Google API: unavailable (477 — would be disabled for this session)")
  }
}
