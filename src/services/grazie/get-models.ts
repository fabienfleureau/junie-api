/**
 * Known Grazie/Junie AI models.
 * Anthropic models use native IDs (MITM-confirmed) and go through native passthrough.
 * Google/OpenAI models use Grazie LLMProfileIDs and go through the translation path.
 */
export const KNOWN_MODELS = [
  // Anthropic — native IDs, passthrough to /v1/messages
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" as const },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic" as const },

  // Google — Grazie LLMProfileIDs, translation path
  { id: "google-chat-gemini-pro-2.5", name: "Gemini 2.5 Pro", provider: "google" as const },
  { id: "google-chat-gemini-flash-2.5", name: "Gemini 2.5 Flash", provider: "google" as const },

  // OpenAI — passthrough to /v1/chat/completions (MITM-confirmed 2026-03-31)
  // Grazie profile IDs are mapped to upstream OpenAI model names in api-config.ts
  { id: "openai-gpt4.1", name: "OpenAI GPT-4.1", provider: "openai" as const },
  { id: "openai-gpt4.1-mini", name: "OpenAI GPT-4.1 Mini", provider: "openai" as const },
  { id: "openai-gpt-4o", name: "OpenAI GPT-4o", provider: "openai" as const },
] as const

export interface ModelsResponse {
  object: "list"
  data: Array<{
    id: string
    object: "model"
    created: number
    owned_by: string
  }>
}

export function getModels(): ModelsResponse {
  return {
    object: "list",
    data: KNOWN_MODELS.map((m) => ({
      id: m.id,
      object: "model" as const,
      created: 0,
      owned_by: m.id.split("-")[0],
    })),
  }
}
