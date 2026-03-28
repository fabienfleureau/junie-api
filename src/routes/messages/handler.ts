import type { Context } from "hono"
import consola from "consola"
import { streamSSE } from "hono/streaming"
import { checkRateLimit } from "~/lib/rate-limit.js"
import { forwardError } from "~/lib/error.js"
import { createChatCompletions } from "~/services/grazie/create-chat-completions.js"

import type { AnthropicMessagesPayload, AnthropicStreamState } from "./anthropic-types.js"
import { translateToAnthropic, translateToOpenAI } from "./non-stream-translation.js"
import { translateChunkToAnthropicEvents } from "./stream-translation.js"

export async function handleCompletion(c: Context) {
  try {
    await checkRateLimit()

    const anthropicPayload = await c.req.json<AnthropicMessagesPayload>()
    consola.debug("Anthropic request payload:", JSON.stringify(anthropicPayload).slice(-400))

    const openAIPayload = translateToOpenAI(anthropicPayload)
    consola.debug("Translated OpenAI payload:", JSON.stringify(openAIPayload).slice(-400))

    const response = await createChatCompletions(openAIPayload)

    if (!response.ok) {
      const text = await response.text()
      consola.error(`Grazie API error: ${response.status} ${text}`)
      return c.json(
        { error: { message: text, type: "upstream_error", code: response.status } },
        { status: response.status as 400 },
      )
    }

    // Non-streaming
    if (!anthropicPayload.stream) {
      const openAIResponse = await response.json()
      consola.debug("Non-streaming response from Grazie")
      const anthropicResponse = translateToAnthropic(openAIResponse)
      return c.json(anthropicResponse)
    }

    // Streaming
    consola.debug("Streaming response from Grazie")
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
  } catch (error) {
    consola.error("Messages handler error:", error)
    return forwardError(error)
  }
}
