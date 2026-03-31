import type { AnthropicResponse, AnthropicStreamEventData, AnthropicStreamState } from "./anthropic-types.js"

/**
 * Grazie V9 SSE data format.
 * Each SSE event contains an LLMData with type discriminators.
 */
interface GrazieLLMData {
  content?: { text?: string }
  functionCall?: { id?: string; name?: string; arguments?: string }
  finishMetadata?: { finishReason?: string }
  quotaMetadata?: {
    promptTokens?: number
    completionTokens?: number
    promptTokensDetails?: { cachedTokens?: number }
  }
}

function isOpenAIChunk(data: unknown): boolean {
  return typeof data === "object" && data !== null && "choices" in data
}

function isGrazieLLMData(data: unknown): boolean {
  return typeof data === "object" && data !== null
    && !("choices" in data)
}

function mapGrazieFinishReason(reason?: string): "end_turn" | "max_tokens" | "tool_use" | null {
  if (!reason) return null
  if (reason === "stop" || reason === "end_turn") return "end_turn"
  if (reason === "length" || reason === "max_tokens") return "max_tokens"
  if (reason === "tool_calls" || reason === "tool_use") return "tool_use"
  return "end_turn"
}

export function translateChunkToAnthropicEvents(
  chunk: unknown,
  state: AnthropicStreamState,
): Array<AnthropicStreamEventData> {
  // Handle OpenAI format (from BYOK endpoint)
  if (isOpenAIChunk(chunk)) {
    return translateOpenAIChunk(chunk as OpenAIChunk, state)
  }

  // Handle Grazie native format
  if (isGrazieLLMData(chunk)) {
    return translateGrazieChunk(chunk as GrazieLLMData, state)
  }

  return []
}

interface OpenAIChunk {
  id?: string
  model?: string
  choices: Array<{
    delta: {
      content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason: string | null
    finish_details?: { type: string }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
  }
}

function translateOpenAIChunk(
  chunk: OpenAIChunk,
  state: AnthropicStreamState,
): Array<AnthropicStreamEventData> {
  const events: Array<AnthropicStreamEventData> = []
  if (chunk.choices.length === 0) return events
  const choice = chunk.choices[0]
  const { delta } = choice

  if (!state.messageStartSent) {
    events.push({ type: "message_start", message: { id: chunk.id ?? "", type: "message", role: "assistant", content: [], model: chunk.model ?? "", stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } })
    state.messageStartSent = true
  }

  if (delta.content) {
    if (state.contentBlockOpen && Object.values(state.toolCalls).some(tc => tc.anthropicBlockIndex === state.contentBlockIndex)) {
      events.push({ type: "content_block_stop", index: state.contentBlockIndex })
      state.contentBlockIndex++
      state.contentBlockOpen = false
    }
    if (!state.contentBlockOpen) {
      events.push({ type: "content_block_start", index: state.contentBlockIndex, content_block: { type: "text", text: "" } })
      state.contentBlockOpen = true
    }
    events.push({ type: "content_block_delta", index: state.contentBlockIndex, delta: { type: "text_delta", text: delta.content } })
  }

  const finishReason = choice.finish_reason ?? choice.finish_details?.type ?? null
  if (finishReason) {
    if (state.contentBlockOpen) { events.push({ type: "content_block_stop", index: state.contentBlockIndex }); state.contentBlockOpen = false }
    const stopMap: Record<string, AnthropicResponse["stop_reason"]> = { stop: "end_turn", length: "max_tokens", tool_calls: "tool_use" }
    events.push({ type: "message_delta", delta: { stop_reason: stopMap[finishReason] ?? "end_turn", stop_sequence: null }, usage: { output_tokens: chunk.usage?.completion_tokens ?? 0 } }, { type: "message_stop" })
  }
  return events
}

function translateGrazieChunk(
  data: GrazieLLMData,
  state: AnthropicStreamState,
): Array<AnthropicStreamEventData> {
  const events: Array<AnthropicStreamEventData> = []

  if (!state.messageStartSent) {
    events.push({
      type: "message_start",
      message: {
        id: `msg_${Date.now()}`, type: "message", role: "assistant", content: [],
        model: "", stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    })
    state.messageStartSent = true
  }

  // Text content
  if (data.content?.text) {
    if (state.contentBlockOpen) {
      const isTool = Object.values(state.toolCalls).some(tc => tc.anthropicBlockIndex === state.contentBlockIndex)
      if (isTool) {
        events.push({ type: "content_block_stop", index: state.contentBlockIndex })
        state.contentBlockIndex++
        state.contentBlockOpen = false
      }
    }
    if (!state.contentBlockOpen) {
      events.push({ type: "content_block_start", index: state.contentBlockIndex, content_block: { type: "text", text: "" } })
      state.contentBlockOpen = true
    }
    events.push({ type: "content_block_delta", index: state.contentBlockIndex, delta: { type: "text_delta", text: data.content.text } })
  }

  // Tool call
  if (data.functionCall) {
    if (data.functionCall.id && data.functionCall.name) {
      if (state.contentBlockOpen) {
        events.push({ type: "content_block_stop", index: state.contentBlockIndex })
        state.contentBlockIndex++
        state.contentBlockOpen = false
      }
      const idx = state.contentBlockIndex
      state.toolCalls[idx] = { id: data.functionCall.id, name: data.functionCall.name, anthropicBlockIndex: idx }
      events.push({ type: "content_block_start", index: idx, content_block: { type: "tool_use", id: data.functionCall.id, name: data.functionCall.name, input: {} } })
      state.contentBlockOpen = true
    }
    if (data.functionCall.arguments) {
      const info = Object.values(state.toolCalls).find(tc => tc.anthropicBlockIndex === state.contentBlockIndex)
      if (info) {
        events.push({ type: "content_block_delta", index: info.anthropicBlockIndex, delta: { type: "input_json_delta", partial_json: data.functionCall.arguments } })
      }
    }
  }

  // Finish
  if (data.finishMetadata) {
    if (state.contentBlockOpen) { events.push({ type: "content_block_stop", index: state.contentBlockIndex }); state.contentBlockOpen = false }
    const usage = data.quotaMetadata
    events.push(
      { type: "message_delta", delta: { stop_reason: mapGrazieFinishReason(data.finishMetadata.finishReason), stop_sequence: null }, usage: { input_tokens: (usage?.promptTokens ?? 0) - (usage?.promptTokensDetails?.cachedTokens ?? 0), output_tokens: usage?.completionTokens ?? 0 } },
      { type: "message_stop" },
    )
  }

  return events
}
