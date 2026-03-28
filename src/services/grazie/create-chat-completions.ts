import { GRAZIE_API, getGrazieHeaders } from "~/lib/api-config.js"
import { state } from "~/lib/state.js"
import invariant from "tiny-invariant"

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

export async function createChatCompletions(
  payload: ChatCompletionsPayload,
): Promise<Response> {
  const token = state.grazieToken ?? state.authToken
  invariant(token, "No authentication token available")

  const url = `${GRAZIE_API.baseUrl}${GRAZIE_API.chatCompletionsPath}`

  const response = await fetch(url, {
    method: "POST",
    headers: getGrazieHeaders(token),
    body: JSON.stringify(payload),
  })

  return response
}
