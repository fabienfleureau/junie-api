import consola from "consola"
import invariant from "tiny-invariant"
import { ANTHROPIC_API, getAnthropicPassthroughHeaders } from "~/lib/api-config.js"
import { redactHeaders } from "~/lib/utils.js"
import { state } from "~/lib/state.js"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types.js"

/** Fields known to be supported by the upstream ingrazzio Anthropic proxy */
const ALLOWED_FIELDS = new Set([
  "model", "messages", "max_tokens", "system", "metadata",
  "stop_sequences", "stream", "temperature", "top_p", "top_k",
  "tools", "tool_choice", "thinking",
])

/**
 * Strip unknown fields before forwarding to upstream.
 * Prevents 400 errors from fields like `context_management` that clients may send
 * but the ingrazzio proxy doesn't support.
 */
function sanitizePayload(payload: AnthropicMessagesPayload): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (ALLOWED_FIELDS.has(key)) {
      safe[key] = key === "system" ? sanitizeSystem(value) : value
    } else {
      consola.debug(`Stripping unknown field from passthrough: ${key}`)
    }
  }
  return safe
}

/**
 * Sanitize system blocks: strip unsupported properties from cache_control.
 * Clients (e.g. Claude Code) may send { type: "ephemeral", scope: "..." } but
 * the upstream Anthropic API only accepts { type: "ephemeral" }.
 */
function sanitizeSystem(system: unknown): unknown {
  if (!Array.isArray(system)) return system
  return system.map((block) => {
    if (typeof block !== "object" || block === null || !("cache_control" in block)) return block
    const { cache_control, ...rest } = block as Record<string, unknown>
    if (typeof cache_control !== "object" || cache_control === null) return block
    const { type } = cache_control as Record<string, unknown>
    return { ...rest, cache_control: { type } }
  })
}

/**
 * Forward an Anthropic /v1/messages request to ingrazzio-cloud-prod.
 * The upstream speaks native Anthropic protocol — only sanitization is needed.
 */
export async function createAnthropicPassthrough(
  payload: AnthropicMessagesPayload,
): Promise<Response> {
  const token = state.authToken
  invariant(token, "No authentication token available")

  const url = `${ANTHROPIC_API.baseUrl}${ANTHROPIC_API.messagesPath}`
  const headers = getAnthropicPassthroughHeaders(token)
  const body = sanitizePayload(payload)

  consola.debug(`>> POST ${url} (anthropic passthrough)`)
  consola.debug(`>> Headers: ${JSON.stringify(redactHeaders(headers))}`)
  consola.debug(`>> Model: ${payload.model}, stream: ${payload.stream ?? false}`)

  const startTime = Date.now()
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const elapsed = Date.now() - startTime

  consola.debug(`<< ${response.status} ${response.statusText} (${elapsed}ms)`)

  if (!response.ok) {
    const text = await response.text()
    const preview = text.length > 200 ? `${text.slice(0, 200)}...` : text
    consola.debug(`<< Body: ${preview}`)
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }

  return response
}
