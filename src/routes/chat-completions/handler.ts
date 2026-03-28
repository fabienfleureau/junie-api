import type { Context } from "hono"
import consola from "consola"
import { streamSSE, type SSEMessage } from "hono/streaming"
import { checkRateLimit } from "~/lib/rate-limit.js"
import { forwardError } from "~/lib/error.js"
import {
  createChatCompletions,
  type ChatCompletionsPayload,
} from "~/services/grazie/create-chat-completions.js"

export async function handleCompletion(c: Context) {
  try {
    await checkRateLimit()

    const payload = await c.req.json<ChatCompletionsPayload>()
    consola.debug("Request payload:", JSON.stringify(payload).slice(-400))

    const response = await createChatCompletions(payload)

    if (!response.ok) {
      const text = await response.text()
      consola.error(`Grazie API error: ${response.status} ${text}`)
      return c.json(
        { error: { message: text, type: "upstream_error", code: response.status } },
        { status: response.status as 400 },
      )
    }

    // Check if streaming
    if (!payload.stream) {
      const data = await response.json()
      consola.debug("Non-streaming response")
      return c.json(data)
    }

    // Stream SSE response
    consola.debug("Streaming response")
    const reader = response.body?.getReader()
    if (!reader) {
      return c.json({ error: { message: "No response body", type: "error" } }, { status: 500 })
    }

    return streamSSE(c, async (stream) => {
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") {
              await stream.writeSSE({ data: "[DONE]" } as SSEMessage)
              return
            }
            await stream.writeSSE({ data } as SSEMessage)
          }
        }
      }
    })
  } catch (error) {
    consola.error("Chat completion error:", error)
    return forwardError(error)
  }
}
