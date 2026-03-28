import { state } from "./state.js"
import { HTTPError } from "./error.js"

export async function checkRateLimit(): Promise<void> {
  if (!state.rateLimitSeconds) return

  const now = Date.now()
  const elapsed = now - (state.lastRequestTimestamp ?? 0)
  const waitMs = state.rateLimitSeconds * 1000

  if (elapsed < waitMs) {
    if (state.rateLimitWait) {
      const remaining = waitMs - elapsed
      await new Promise((resolve) => setTimeout(resolve, remaining))
    } else {
      throw new HTTPError(429, `Rate limit: wait ${Math.ceil((waitMs - elapsed) / 1000)}s`)
    }
  }

  state.lastRequestTimestamp = Date.now()
}
