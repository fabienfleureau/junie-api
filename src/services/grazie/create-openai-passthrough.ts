import consola from "consola"
import invariant from "tiny-invariant"
import { OPENAI_PASSTHROUGH_API, getOpenAIPassthroughHeaders, resolveOpenAIModelId } from "~/lib/api-config.js"
import { redactHeaders } from "~/lib/utils.js"
import { state } from "~/lib/state.js"

import type { ChatCompletionsPayload } from "./create-chat-completions.js"

/** Fields known to be supported by the upstream ingrazzio OpenAI proxy */
const ALLOWED_FIELDS = new Set([
  "model", "messages", "max_tokens", "temperature", "top_p",
  "stream", "stop", "tools", "tool_choice", "seed",
  "response_format",
])

/**
 * Strip unknown fields before forwarding to upstream.
 * Also maps the model ID from Grazie profile to actual OpenAI name.
 */
function sanitizePayload(payload: ChatCompletionsPayload): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (ALLOWED_FIELDS.has(key)) {
      safe[key] = value
    } else {
      consola.debug(`Stripping unknown field from OpenAI passthrough: ${key}`)
    }
  }
  // Map Grazie profile ID to upstream OpenAI model name
  safe.model = resolveOpenAIModelId(payload.model)
  return safe
}

/**
 * Forward an OpenAI /v1/chat/completions request to ingrazzio-cloud-prod.
 * The upstream speaks native OpenAI protocol — only sanitization and model ID mapping needed.
 */
export async function createOpenAIPassthrough(
  payload: ChatCompletionsPayload,
): Promise<Response> {
  const token = state.authToken
  invariant(token, "No authentication token available")

  const url = `${OPENAI_PASSTHROUGH_API.baseUrl}${OPENAI_PASSTHROUGH_API.chatCompletionsPath}`
  const headers = getOpenAIPassthroughHeaders(token)
  const body = sanitizePayload(payload)

  consola.debug(`>> POST ${url} (openai passthrough)`)
  consola.debug(`>> Headers: ${JSON.stringify(redactHeaders(headers))}`)
  consola.debug(`>> Model: ${payload.model} → ${body.model}, stream: ${payload.stream ?? false}`)

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
