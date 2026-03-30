import consola from "consola"
import { serve } from "srvx"
import clipboard from "clipboardy"
import invariant from "tiny-invariant"

import { state } from "./lib/state.js"
import { setupAuthTokenFromFile, saveAuthToken } from "./lib/token.js"
import { generateEnvScript } from "./lib/shell.js"
import { runAuthFlow } from "./auth.js"
import { server } from "./server.js"
import { KNOWN_MODELS } from "./services/grazie/get-models.js"
import { validateIngrazzioToken } from "./services/grazie/get-grazie-token.js"

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

  // Show account balance
  try {
    const authInfo = await validateIngrazzioToken(state.authToken)
    if (authInfo.balanceLeft != null) {
      consola.success(`Balance: ${authInfo.balanceLeft.toFixed(2)} ${authInfo.balanceUnit ?? "USD"} (${authInfo.licenseType ?? "unknown"} license)`)
    }
  } catch {
    consola.warn("Could not fetch account balance")
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
