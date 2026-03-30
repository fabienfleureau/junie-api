import consola from "consola"
import invariant from "tiny-invariant"
import { GRAZIE_API, getGrazieHeaders } from "~/lib/api-config.js"
import { redactHeaders } from "~/lib/utils.js"
import { state } from "~/lib/state.js"

export interface ChatCompletionsPayload {
  model: string
  messages: Array<{
    role: string
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
    name?: string
    tool_calls?: Array<{
      id: string
      type: "function"
      function: { name: string; arguments: string }
    }>
    tool_call_id?: string
  }>
  temperature?: number
  top_p?: number
  max_tokens?: number
  stream?: boolean
  stop?: string | string[]
  tools?: Array<{
    type: "function"
    function: {
      name: string
      description?: string
      parameters?: Record<string, unknown>
    }
  }>
  tool_choice?: string | { type: string; function?: { name: string } }
}

/** Summarize payload without message content */
function summarizePayload(payload: ChatCompletionsPayload): string {
  const msgCount = payload.messages.length
  const roles = payload.messages.map((m) => m.role).join(",")
  const toolCount = payload.tools?.length ?? 0
  const parts = [
    `model=${payload.model}`,
    `messages=${msgCount} [${roles}]`,
    `stream=${payload.stream ?? false}`,
  ]
  if (payload.max_tokens) parts.push(`max_tokens=${payload.max_tokens}`)
  if (payload.temperature !== undefined) parts.push(`temperature=${payload.temperature}`)
  if (toolCount) parts.push(`tools=${toolCount}`)
  if (payload.stop) parts.push(`stop=${JSON.stringify(payload.stop)}`)
  return parts.join(", ")
}

/**
 * Convert OpenAI-format messages to Grazie native chat message format.
 * Grazie uses { content: string, role: "system"|"user"|"assistant" }
 */
function toGrazieMessages(
  messages: ChatCompletionsPayload["messages"],
): Array<{ content: string; role: string }> {
  return messages.map((m) => {
    // Flatten content arrays to plain text
    let content: string
    if (typeof m.content === "string") {
      content = m.content
    } else if (Array.isArray(m.content)) {
      content = m.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n")
    } else {
      content = ""
    }

    // Include tool calls as text in assistant messages
    if (m.tool_calls && m.tool_calls.length > 0) {
      const toolText = m.tool_calls
        .map((tc) => `Tool call: ${tc.function.name}(${tc.function.arguments})`)
        .join("\n")
      content = content ? `${content}\n${toolText}` : toolText
    }

    return { content, role: m.role }
  })
}

/**
 * Build the Grazie native request body for /llm/chat/stream/v9.
 * Format: { profile: LLMProfileID, chat: { messages: [...] } }
 */
function toGrazieRequestBody(payload: ChatCompletionsPayload) {
  const messages = toGrazieMessages(payload.messages)

  return {
    profile: payload.model,
    chat: {
      messages,
    },
  }
}

export async function createChatCompletions(
  payload: ChatCompletionsPayload,
): Promise<Response> {
  const token = state.authToken
  invariant(token, "No authentication token available")

  const url = `${GRAZIE_API.baseUrl}${GRAZIE_API.chatStreamPath}`
  const headers = getGrazieHeaders(token)
  const grazieBody = toGrazieRequestBody(payload)

  consola.debug(`>> POST ${url}`)
  consola.debug(`>> Headers: ${JSON.stringify(redactHeaders(headers))}`)
  consola.debug(`>> Body: ${summarizePayload(payload)} (grazie profile: ${payload.model})`)

  const startTime = Date.now()
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(grazieBody),
  })
  const elapsed = Date.now() - startTime

  const respHeaders: Record<string, string> = {}
  response.headers.forEach((v, k) => { respHeaders[k] = v })

  consola.debug(`<< ${response.status} ${response.statusText} (${elapsed}ms)`)
  consola.debug(`<< Headers: ${JSON.stringify(respHeaders)}`)

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

  consola.debug(`<< Body: [streaming]`)
  return response
}
