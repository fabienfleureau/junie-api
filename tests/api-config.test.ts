import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { GRAZIE_API } from "../src/lib/api-config.js"

describe("GRAZIE_API", () => {
  test("uses api.jetbrains.ai as LLM base URL", () => {
    assert.equal(GRAZIE_API.baseUrl, "https://api.jetbrains.ai")
  })
  test("has correct chat stream path", () => {
    assert.equal(GRAZIE_API.chatStreamPath, "/llm/chat/stream/v9")
  })
  test("auth validation uses ingrazzio-cloud-prod", () => {
    assert.equal(GRAZIE_API.authBaseUrl, "https://ingrazzio-cloud-prod.labs.jb.gg")
  })
})
