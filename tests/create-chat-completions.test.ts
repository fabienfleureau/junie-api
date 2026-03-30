import { test, describe, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { GRAZIE_API } from "../src/lib/api-config.js"
import { state } from "../src/lib/state.js"
import type { ChatCompletionsPayload } from "../src/services/grazie/create-chat-completions.js"

let fetchCalls: Array<{ url: string; init: RequestInit }> = []

const mockFetch = (_url: string, init: RequestInit = {}) => {
  fetchCalls.push({ url: _url, init })
  return Promise.resolve(
    new Response(JSON.stringify({ id: "123", object: "chat.completion", choices: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  )
}
;(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch

const { createChatCompletions } = await import("../src/services/grazie/create-chat-completions.js")

state.authToken = "test-token"

describe("createChatCompletions", () => {
  beforeEach(() => {
    fetchCalls = []
  })

  test("calls api.jetbrains.ai endpoint", async () => {
    const payload: ChatCompletionsPayload = {
      model: "anthropic-claude-4-5-haiku",
      messages: [{ role: "user", content: "hi" }],
    }
    await createChatCompletions(payload)
    assert.ok(fetchCalls[0].url.startsWith(GRAZIE_API.baseUrl))
    assert.ok(fetchCalls[0].url.includes(GRAZIE_API.chatStreamPath))
  })

  test("sets Authorization header with Bearer token", async () => {
    const payload: ChatCompletionsPayload = {
      model: "anthropic-claude-4-5-haiku",
      messages: [{ role: "user", content: "hi" }],
    }
    await createChatCompletions(payload)
    const headers = fetchCalls[0].init.headers as Record<string, string>
    assert.equal(headers["Authorization"], "Bearer test-token")
  })

  test("wraps payload in Grazie native format with profile field", async () => {
    const payload: ChatCompletionsPayload = {
      model: "anthropic-claude-4-5-haiku",
      messages: [{ role: "user", content: "hi" }],
    }
    await createChatCompletions(payload)
    const body = JSON.parse(fetchCalls[0].init.body as string)
    assert.equal(body.profile, "anthropic-claude-4-5-haiku")
    assert.ok(body.chat)
    assert.ok(body.chat.messages)
    assert.equal(body.chat.messages[0].role, "user")
  })
})
