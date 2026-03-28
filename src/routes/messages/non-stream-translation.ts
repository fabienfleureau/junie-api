import type { ChatCompletionsPayload } from "~/services/grazie/create-chat-completions.js"

import type {
  AnthropicAssistantContentBlock,
  AnthropicAssistantMessage,
  AnthropicMessage,
  AnthropicMessagesPayload,
  AnthropicResponse,
  AnthropicTextBlock,
  AnthropicThinkingBlock,
  AnthropicTool,
  AnthropicToolResultBlock,
  AnthropicToolUseBlock,
  AnthropicUserContentBlock,
  AnthropicUserMessage,
} from "./anthropic-types.js"
import { mapOpenAIStopReasonToAnthropic } from "./utils.js"

// --- Request translation (Anthropic → OpenAI) ---

export function translateToOpenAI(
  payload: AnthropicMessagesPayload,
): ChatCompletionsPayload {
  return {
    model: payload.model,
    messages: translateMessages(payload.messages, payload.system),
    max_tokens: payload.max_tokens,
    stop: payload.stop_sequences,
    stream: payload.stream,
    temperature: payload.temperature,
    top_p: payload.top_p,
    tools: translateTools(payload.tools),
    tool_choice: translateToolChoice(payload.tool_choice),
  }
}

function translateMessages(
  messages: Array<AnthropicMessage>,
  system: string | Array<AnthropicTextBlock> | undefined,
): ChatCompletionsPayload["messages"] {
  const result: ChatCompletionsPayload["messages"] = []

  if (system) {
    const text = typeof system === "string"
      ? system
      : system.map((b) => b.text).join("\n\n")
    result.push({ role: "system", content: text })
  }

  for (const message of messages) {
    if (message.role === "user") {
      result.push(...handleUserMessage(message))
    } else {
      result.push(...handleAssistantMessage(message))
    }
  }

  return result
}

function handleUserMessage(message: AnthropicUserMessage): ChatCompletionsPayload["messages"] {
  const result: ChatCompletionsPayload["messages"] = []

  if (Array.isArray(message.content)) {
    const toolResults = message.content.filter(
      (b): b is AnthropicToolResultBlock => b.type === "tool_result",
    )
    const others = message.content.filter((b) => b.type !== "tool_result")

    for (const block of toolResults) {
      result.push({
        role: "tool",
        tool_call_id: block.tool_use_id,
        content: mapContent(block.content),
      })
    }

    if (others.length > 0) {
      result.push({ role: "user", content: mapContent(others) })
    }
  } else {
    result.push({ role: "user", content: message.content })
  }

  return result
}

function handleAssistantMessage(message: AnthropicAssistantMessage): ChatCompletionsPayload["messages"] {
  if (!Array.isArray(message.content)) {
    return [{ role: "assistant", content: message.content as string }]
  }

  const toolUseBlocks = message.content.filter(
    (b): b is AnthropicToolUseBlock => b.type === "tool_use",
  )
  const textBlocks = message.content.filter(
    (b): b is AnthropicTextBlock => b.type === "text",
  )
  const thinkingBlocks = message.content.filter(
    (b): b is AnthropicThinkingBlock => b.type === "thinking",
  )

  const allText = [
    ...textBlocks.map((b) => b.text),
    ...thinkingBlocks.map((b) => b.thinking),
  ].join("\n\n")

  if (toolUseBlocks.length > 0) {
    return [{
      role: "assistant",
      content: allText || "",
      tool_calls: toolUseBlocks.map((t) => ({
        id: t.id,
        type: "function" as const,
        function: { name: t.name, arguments: JSON.stringify(t.input) },
      })),
    }]
  }

  return [{ role: "assistant", content: allText }]
}

type ContentInput = string | Array<AnthropicUserContentBlock | AnthropicAssistantContentBlock>

function mapContent(content: ContentInput): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .filter(
      (b): b is AnthropicTextBlock | AnthropicThinkingBlock =>
        b.type === "text" || b.type === "thinking",
    )
    .map((b) => (b.type === "text" ? b.text : b.thinking))
    .join("\n\n")
}

function translateTools(tools: Array<AnthropicTool> | undefined): ChatCompletionsPayload["tools"] {
  if (!tools) return undefined
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

function translateToolChoice(
  choice: AnthropicMessagesPayload["tool_choice"],
): ChatCompletionsPayload["tool_choice"] {
  if (!choice) return undefined
  switch (choice.type) {
    case "auto": return "auto"
    case "any": return "required"
    case "none": return "none"
    case "tool":
      return choice.name
        ? { type: "function", function: { name: choice.name } }
        : undefined
    default: return undefined
  }
}

// --- Response translation (OpenAI → Anthropic) ---

interface OpenAIChoice {
  message: {
    content: string | null
    tool_calls?: Array<{
      id: string
      type: "function"
      function: { name: string; arguments: string }
    }>
  }
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null
}

interface OpenAIChatCompletionResponse {
  id: string
  model: string
  choices: Array<OpenAIChoice>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
  }
}

export function translateToAnthropic(
  response: OpenAIChatCompletionResponse,
): AnthropicResponse {
  const allTextBlocks: Array<AnthropicTextBlock> = []
  const allToolUseBlocks: Array<AnthropicToolUseBlock> = []
  let stopReason: OpenAIChoice["finish_reason"] = response.choices[0]?.finish_reason ?? null

  for (const choice of response.choices) {
    if (choice.message.content) {
      allTextBlocks.push({ type: "text", text: choice.message.content })
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        allToolUseBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        })
      }
    }

    if (choice.finish_reason === "tool_calls" || stopReason === "stop") {
      stopReason = choice.finish_reason
    }
  }

  const content: Array<AnthropicAssistantContentBlock> = [...allTextBlocks, ...allToolUseBlocks]

  return {
    id: response.id,
    type: "message",
    role: "assistant",
    model: response.model,
    content,
    stop_reason: mapOpenAIStopReasonToAnthropic(stopReason),
    stop_sequence: null,
    usage: {
      input_tokens:
        (response.usage?.prompt_tokens ?? 0)
        - (response.usage?.prompt_tokens_details?.cached_tokens ?? 0),
      output_tokens: response.usage?.completion_tokens ?? 0,
      ...(response.usage?.prompt_tokens_details?.cached_tokens !== undefined && {
        cache_read_input_tokens: response.usage.prompt_tokens_details.cached_tokens,
      }),
    },
  }
}
