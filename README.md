# Junie API Proxy

> [!WARNING]
> This is a reverse-engineered proxy of JetBrains Junie/Grazie AI API. It is not supported by JetBrains, and may break unexpectedly. Use at your own risk.

> [!WARNING]
> **JetBrains Terms of Service:**
> Use of JetBrains AI services is subject to the [JetBrains AI Service Terms of Service](https://www.jetbrains.com/legal/docs/terms/jetbrains-ai-service/).
> Excessive automated or scripted use may violate these terms and could result in suspension of your account or access.
>
> This proxy is intended for personal use with your own JetBrains/Junie subscription. Please use responsibly.

---

> A proxy for the JetBrains Junie/Grazie AI API that exposes it as an OpenAI and Anthropic compatible service. Use your Junie subscription with any tool that supports these APIs, including [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview).

## Features

- **OpenAI Compatibility**: Exposes Junie AI as an OpenAI-compatible API (`/v1/chat/completions`, `/v1/models`)
- **Anthropic Compatibility**: Exposes Junie AI as an Anthropic-compatible API (`/v1/messages`)
- **Claude Code Integration**: Launch Claude Code with Junie as its backend via `--claude-code` flag
- **Multiple Auth Methods**: JetBrains OAuth device flow or direct API key
- **Rate Limiting**: Control API usage with `--rate-limit` and `--wait` options

## Quick Start

```sh
bunx junie-api
```

That's it — the first run will guide you through JetBrains OAuth. The server starts on `http://localhost:4141`.

### With Claude Code

```sh
bunx junie-api --claude-code
```

### With an API key

```sh
bunx junie-api --auth-token YOUR_API_KEY
```

Get your key from [junie.jetbrains.com/cli](https://junie.jetbrains.com/cli).

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /v1/chat/completions` | POST | OpenAI-compatible chat completions |
| `GET /v1/models` | GET | List available models |
| `POST /v1/messages` | POST | Anthropic-compatible messages |

### Claude Code Setup

Use the `--claude-code` flag, or manually add to `.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:4141",
    "ANTHROPIC_AUTH_TOKEN": "dummy",
    "ANTHROPIC_MODEL": "claude-opus-4-6",
    "ANTHROPIC_SMALL_FAST_MODEL": "claude-sonnet-4-6",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

## CLI Reference

```sh
bunx junie-api                          # Start server (default)
bunx junie-api start                    # Same as above
bunx junie-api start --port 8080 -v     # Custom port, verbose
bunx junie-api start --rate-limit 30 -w # Rate limit: 30s, wait
bunx junie-api start --claude-code      # With Claude Code setup
bunx junie-api auth                     # Authenticate only
```

| Option | Description | Default | Alias |
|--------|-------------|---------|-------|
| --port | Port to listen on | 4141 | -p |
| --verbose | Enable verbose logging | false | -v |
| --auth-token | Provide auth token directly | none | -a |
| --show-token | Show tokens on fetch/refresh | false | |
| --rate-limit | Rate limit in seconds | none | -r |
| --wait | Wait instead of error on rate limit | false | -w |
| --claude-code | Generate Claude Code launch command | false | -c |

## Development

```sh
bun install
bun run build       # Build with tsdown
bun test            # Run tests
bun run dev         # Dev with --watch
bun run typecheck   # TypeScript check
```

## Architecture

Two routing paths:

### Anthropic Native Passthrough (`/v1/messages` with `claude-*` models)
- Forwards requests to the upstream Anthropic-compatible endpoint
- Sanitizes unknown fields before forwarding (e.g., `context_management`)
- Streaming: pipes upstream SSE directly to client

### Translation Path (`/v1/messages` with non-Claude models, `/v1/chat/completions`)
- Translates Anthropic format → OpenAI format → Grazie native protocol
- Wraps in `{ profile, chat: { messages } }` for the Grazie gateway
- Translates responses back to the requested format

## License

MIT
