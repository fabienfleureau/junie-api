import consola from "consola"
import { serve } from "srvx"
import clipboard from "clipboardy"
import invariant from "tiny-invariant"

import { state } from "./lib/state.js"
import { setupAuthTokenFromFile, saveAuthToken, setupTokenRefresh, getJwtExpiresIn } from "./lib/token.js"
import { generateEnvScript } from "./lib/shell.js"
import { runAuthFlow } from "./auth.js"
import { server } from "./server.js"
import { KNOWN_MODELS } from "./services/grazie/get-models.js"
import { validateIngrazzioToken, probeFreeGoogleApi } from "./services/grazie/get-grazie-token.js"
import { refreshAccessToken } from "./services/jetbrains/poll-token.js"

interface StartOptions {
  port: number
  verbose: boolean
  authToken?: string
  showToken: boolean
  rateLimit?: number
  wait: boolean
  claudeCode: boolean
}

export async function start(options: StartOptions): Promise<void> {
  state.verbose = options.verbose
  state.showToken = options.showToken
  state.rateLimitSeconds = options.rateLimit
  state.rateLimitWait = options.wait

  if (options.verbose) {
    consola.level = 5
  }

  // Setup auth token
  if (options.authToken) {
    saveAuthToken(options.authToken)
    consola.success("Using provided auth token")
  } else if (!setupAuthTokenFromFile()) {
    await runAuthFlow({ showToken: options.showToken })
  }

  if (!state.authToken) {
    consola.error("No authentication token available. Run 'junie-api auth' first.")
    process.exit(1)
  }

  // Schedule token auto-refresh (for saved tokens / --auth-token that skip the OAuth flow)
  if (state.refreshToken) {
    const expiresIn = getJwtExpiresIn(state.authToken)
    if (expiresIn !== undefined) {
      setupTokenRefresh(expiresIn)
    }
  }

  // Validate token by fetching account balance; refresh or re-auth on failure
  let balanceOk = false
  try {
    const authInfo = await validateIngrazzioToken(state.authToken)
    balanceOk = true
    if (authInfo.balanceLeft != null) {
      consola.success(`Balance: ${authInfo.balanceLeft.toFixed(2)} ${authInfo.balanceUnit ?? "USD"} (${authInfo.licenseType ?? "unknown"} license)`)
    }

    // Probe free Google API tier
    const freeInfo = await probeFreeGoogleApi(state.authToken)
    if (state.freeGoogleApi) {
      consola.success("Free Google API: available")
      if (freeInfo?.balanceLeft != null) {
        consola.info(`  Free tier balance: ${freeInfo.balanceLeft.toFixed(2)} ${freeInfo.balanceUnit ?? "USD"}`)
      }
    } else {
      consola.warn("Free Google API: unavailable (477 — disabled for this session)")
    }
  } catch {
    consola.warn("Token validation failed, attempting refresh...")
  }

  if (!balanceOk && state.refreshToken) {
    try {
      const response = await refreshAccessToken(state.refreshToken)
      saveAuthToken(response.access_token, response.refresh_token)
      consola.success("Token refreshed")

      const authInfo = await validateIngrazzioToken(state.authToken)
      balanceOk = true
      if (authInfo.balanceLeft != null) {
        consola.success(`Balance: ${authInfo.balanceLeft.toFixed(2)} ${authInfo.balanceUnit ?? "USD"} (${authInfo.licenseType ?? "unknown"} license)`)
      }
    } catch {
      consola.warn("Token refresh failed, starting auth flow...")
    }
  }

  if (!balanceOk) {
    try {
      await runAuthFlow({ showToken: options.showToken })
      const authInfo = await validateIngrazzioToken(state.authToken)
      if (authInfo.balanceLeft != null) {
        consola.success(`Balance: ${authInfo.balanceLeft.toFixed(2)} ${authInfo.balanceUnit ?? "USD"} (${authInfo.licenseType ?? "unknown"} license)`)
      }
    } catch {
      consola.warn("Could not validate token after re-auth")
    }
  }

  // Load known models
  state.models = KNOWN_MODELS.map((m) => ({ id: m.id, name: m.name }))
  consola.info(
    `Available models:\n${state.models.map((m) => `  - ${m.id}`).join("\n")}`,
  )

  const serverUrl = `http://localhost:${options.port}`

  // Claude Code integration with interactive model selection
  if (options.claudeCode) {
    invariant(state.models, "Models should be loaded by now")

    const modelOptions = state.models.map((m) => m.id)

    const opusModel = await consola.prompt(
      "Select the primary model (Opus-tier, most capable)",
      { type: "select", options: modelOptions },
    )

    const sonnetModel = await consola.prompt(
      "Select the default model (Sonnet-tier, balanced)",
      { type: "select", options: modelOptions },
    )

    const haikuModel = await consola.prompt(
      "Select the small/fast model (Haiku-tier, cheapest)",
      { type: "select", options: modelOptions },
    )

    const command = generateEnvScript(
      {
        ANTHROPIC_BASE_URL: serverUrl,
        ANTHROPIC_AUTH_TOKEN: "dummy",
        ANTHROPIC_MODEL: opusModel,
        ANTHROPIC_DEFAULT_SONNET_MODEL: sonnetModel,
        ANTHROPIC_SMALL_FAST_MODEL: haikuModel,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: haikuModel,
        DISABLE_NON_ESSENTIAL_MODEL_CALLS: "1",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      },
      "claude",
    )

    try {
      clipboard.writeSync(command)
      consola.success("Copied Claude Code command to clipboard!")
    } catch {
      consola.warn("Failed to copy to clipboard. Here is the command:")
      consola.log(command)
    }
  }

  // Start HTTP server
  await serve({
    port: options.port,
    fetch: server.fetch,
  })

  consola.success(`Server running at ${serverUrl}`)
  consola.info("Endpoints:")
  consola.info(`  OpenAI:    POST ${serverUrl}/v1/chat/completions`)
  consola.info(`  Anthropic: POST ${serverUrl}/v1/messages`)
  consola.info(`  Models:    GET  ${serverUrl}/v1/models`)
}
