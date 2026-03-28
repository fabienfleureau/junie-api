import consola from "consola"
import { serve } from "srvx"
import clipboard from "clipboardy"

import { state } from "./lib/state.js"
import { setupAuthTokenFromFile, saveAuthToken } from "./lib/token.js"
import { generateExportCommands } from "./lib/shell.js"
import { runAuthFlow } from "./auth.js"
import { server } from "./server.js"

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
    consola.level = 4
  }

  // Setup auth token
  if (options.authToken) {
    // Direct token from CLI (API key or pre-obtained JWT)
    saveAuthToken(options.authToken)
    consola.success("Using provided auth token")
  } else if (!setupAuthTokenFromFile()) {
    // No saved token, run OAuth flow
    await runAuthFlow({ showToken: options.showToken })
  }

  if (!state.authToken) {
    consola.error("No authentication token available. Run 'junie-api auth' first.")
    process.exit(1)
  }

  // Claude Code integration
  if (options.claudeCode) {
    await setupClaudeCode(options.port)
  }

  // Start HTTP server
  consola.info(`Starting Junie API proxy on port ${options.port}...`)

  await serve({
    port: options.port,
    fetch: server.fetch,
  })

  consola.success(`Server running at http://localhost:${options.port}`)
  consola.info("Endpoints:")
  consola.info(`  OpenAI:    POST http://localhost:${options.port}/v1/chat/completions`)
  consola.info(`  Anthropic: POST http://localhost:${options.port}/v1/messages`)
  consola.info(`  Models:    GET  http://localhost:${options.port}/v1/models`)
}

async function setupClaudeCode(port: number): Promise<void> {
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: `http://localhost:${port}`,
    ANTHROPIC_AUTH_TOKEN: "dummy",
    ANTHROPIC_MODEL: "google/gemini-2.5-pro",
    ANTHROPIC_SMALL_FAST_MODEL: "google/gemini-2.5-flash",
    DISABLE_NON_ESSENTIAL_MODEL_CALLS: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  }

  const command = generateExportCommands(env)
  const fullCommand = `${command}\nclaude`

  consola.box(
    "Claude Code Integration\n\n" +
    "Run the following in a new terminal:\n\n" +
    fullCommand,
  )

  try {
    await clipboard.write(fullCommand)
    consola.success("Command copied to clipboard!")
  } catch {
    consola.warn("Could not copy to clipboard")
  }
}
