# junie-api

## Build & Test
- Build: `bun run build` (uses tsdown)
- Test: `bun test` (Node built-in runner via tsx)
- Dev: `node --watch --import tsx ./src/main.ts`

## Architecture

Three routing paths:

### 1. Anthropic Native Passthrough (models starting with `claude-`)
- Forwards Anthropic `/v1/messages` requests to `ingrazzio-cloud-prod.labs.jb.gg/v1/messages`
- Sanitizes payload (whitelist of known fields) before forwarding
- No format translation — request/response are already native Anthropic protocol
- Streaming: pipes upstream Anthropic SSE directly to client
- Route: `handler.ts` → `create-anthropic-passthrough.ts` → upstream

### 2. OpenAI Native Passthrough (models starting with `openai-`)
- Forwards OpenAI `/v1/chat/completions` requests to `ingrazzio-cloud-prod.labs.jb.gg/v1/chat/completions`
- Maps Grazie profile IDs to upstream OpenAI model names (e.g. `openai-gpt4.1` → `gpt-4.1-2025-04-14`)
- No format translation — request/response are native OpenAI protocol
- For `/v1/messages`: translates Anthropic→OpenAI, sends via passthrough, translates response back
- Route: `handler.ts` → `create-openai-passthrough.ts` → upstream

### 3. Translation Path (Google models)
- Translates Anthropic format → OpenAI format → Grazie native protocol
- Wraps in `{ profile, chat: { messages } }` format for `api.jetbrains.ai/llm/chat/stream/v9`
- Translates Grazie/OpenAI responses back to Anthropic format
- Route: `handler.ts` → `create-chat-completions.ts` → Grazie gateway

## Ingrazzio API

**Anthropic Passthrough:**
- Endpoint: `https://ingrazzio-cloud-prod.labs.jb.gg/v1/messages`
- Auth: `Authorization: Bearer <token>` (JBA JWT or `perm-*` keys)
- Model IDs: `claude-sonnet-4-6`, `claude-opus-4-6`
- See `getAnthropicPassthroughHeaders()` in `api-config.ts`

**OpenAI Passthrough:**
- Endpoint: `https://ingrazzio-cloud-prod.labs.jb.gg/v1/chat/completions`
- Auth: `Authorization: Bearer <token>` (JBA JWT or `perm-*` keys)
- Model IDs: mapped from Grazie profiles → upstream names (`openai-gpt4.1` → `gpt-4.1-2025-04-14`)
- See `getOpenAIPassthroughHeaders()` and `resolveOpenAIModelId()` in `api-config.ts`

**Grazie Gateway (translation path):**
- Endpoint: `https://api.jetbrains.ai/llm/chat/stream/v9`
- Model IDs: Grazie LLMProfileIDs like `google-chat-gemini-pro-2.5`

**Auth validation:** `GET https://ingrazzio-cloud-prod.labs.jb.gg/auth/test`

## Model IDs

Anthropic models: `claude-sonnet-4-6`, `claude-opus-4-6`

OpenAI models (passthrough, mapped to upstream names):
- `openai-gpt4.1` → `gpt-4.1-2025-04-14`
- `openai-gpt4.1-mini` → `gpt-4.1-mini-2025-04-14`
- `openai-gpt-4o` → `gpt-4o`

Google models (Grazie LLMProfileIDs, translation path):
- `google-chat-gemini-pro-2.5`, `google-chat-gemini-flash-2.5`

See `src/services/grazie/get-models.ts` for full list.

## Observed token behavior
- `perm-*` keys and JBA OAuth JWTs: use `Authorization: Bearer <token>`
- GitHub tokens (`ghp_`, `github_pat_`): use `Authorization: GitHub <token>`
