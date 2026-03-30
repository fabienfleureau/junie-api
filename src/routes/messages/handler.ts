import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import consola from "consola"
import { streamSSE } from "hono/streaming"
import { checkRateLimit } from "~/lib/rate-limit.js"
import { forwardError } from "~/lib/error.js"
import { isAnthropicModel } from "~/lib/api-config.js"
import { createChatCompletions } from "~/services/grazie/create-chat-completions.js"
import { createAnthropicPassthrough } from "~/services/grazie/create-anthropic-passthrough.js"

import type { AnthropicMessagesPayload, AnthropicStreamState } from "./anthropic-types.js"
import { translateToAnthropic, translateToOpenAI } from "./non-stream-translation.js"
import { translateChunkToAnthropicEvents } from "./stream-translation.js"

export async function handleCompletion(c: Context) {
  try {
    await checkRateLimit()

    const anthropicPayload = await c.req.json<AnthropicMessagesPayload>()
    consola.debug(`[${anthropicPayload.model}] Incoming request, stream=${anthropicPayload.stream ?? false}`)

    // Route based on model: Anthropic models get native passthrough, others go through translation
    if (isAnthropicModel(anthropicPayload.model)) {
      return handleAnthropicPassthrough(c, anthropicPayload)
    }

    return handleTranslatedRequest(c, anthropicPayload)
  } catch (error) {
    consola.error("Messages handler error:", error)
    return forwardError(error)
  }
}

/**
 * Anthropic native passthrough: forward request verbatim to ingrazzio-cloud-prod/v1/messages.
 * The upstream already speaks Anthropic protocol — no translation needed at all.
 */
async function handleAnthropicPassthrough(c: Context, payload: AnthropicMessagesPayload) {
  const response = await createAnthropicPassthrough(payload)

  if (!response.ok) {
    const text = await response.text()
    consola.error(`[${payload.model}] Anthropic upstream error: ${response.status} ${text}`)
    return c.json(
      { error: { message: text, type: "upstream_error", code: response.status } },
      { status: response.status as ContentfulStatusCode },
    )
  }

  // Non-streaming: forward JSON response as-is
  if (!payload.stream) {
    const data = await response.json()
    consola.debug(`[${payload.model}] Non-streaming response (${data.usage?.output_tokens ?? "?"} output tokens)`)
    return c.json(data)
  }

  // Streaming: pipe upstream Anthropic SSE directly to client
  // The response body is already Anthropic SSE format (event: message_start, data: {...}, etc.)
  // No parsing or translation needed — just relay the bytes.
  consola.debug(`[${payload.model}] Streaming passthrough`)
  const reader = response.body?.getReader()
  if (!reader) {
    return c.json({ error: { message: "No response body", type: "error" } }, { status: 500 })
  }

  return streamSSE(c, async (stream) => {
    const decoder = new TextDecoder()
    let buffer = ""
    let pendingEventType: string | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        // Relay SSE lines verbatim: "event: <type>" and "data: <json>"
        if (line.startsWith("event: ")) {
          pendingEventType = line.slice(7).trim()
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6)
          await stream.writeSSE({ event: pendingEventType ?? "message", data })
          pendingEventType = undefined
        }
        // Skip empty lines (SSE separators) and comments
      }
    }
  })
}

/**
 * Translation path: convert Anthropic → OpenAI → Grazie native, then translate back.
 * Used for Google and OpenAI models that don't support native Anthropic protocol.
 */
async function handleTranslatedRequest(c: Context, payload: AnthropicMessagesPayload) {
  const openAIPayload = translateToOpenAI(payload)
  consola.debug(`[${payload.model}] Translated to OpenAI format`)

  const response = await createChatCompletions(openAIPayload)

  if (!response.ok) {
    const text = await response.text()
    consola.error(`[${payload.model}] Grazie API error: ${response.status} ${text}`)
    return c.json(
      { error: { message: text, type: "upstream_error", code: response.status } },
      { status: response.status as ContentfulStatusCode },
    )
  }

  // Non-streaming
  if (!payload.stream) {
    const openAIResponse = await response.json()
    consola.debug(`[${payload.model}] Non-streaming response from Grazie`)
    const anthropicResponse = translateToAnthropic(openAIResponse)
    return c.json(anthropicResponse)
  }

  // Streaming
  consola.debug(`[${payload.model}] Streaming response from Grazie (translation path)`)
  const reader = response.body?.getReader()
  if (!reader) {
    return c.json({ error: { message: "No response body", type: "error" } }, { status: 500 })
  }

  return streamSSE(c, async (stream) => {
    const streamState: AnthropicStreamState = {
      messageStartSent: false,
      contentBlockIndex: 0,
      contentBlockOpen: false,
      toolCalls: {},
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6)
        if (data === "[DONE]") break

        try {
          const chunk = JSON.parse(data)
          const events = translateChunkToAnthropicEvents(chunk, streamState)

          for (const event of events) {
            await stream.writeSSE({
              event: event.type,
              data: JSON.stringify(event),
            })
          }
        } catch (e) {
          consola.debug("Failed to parse streaming chunk:", data, e)
        }
      }
    }
  })
}
