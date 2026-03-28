# Junie API Proxy

> A proxy for the JetBrains Junie/Grazie AI API that exposes it as an OpenAI and Anthropic compatible service. Use your Junie subscription with any tool that supports these APIs, including [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview).

## Features

- **OpenAI Compatibility**: Exposes Junie AI as an OpenAI-compatible API (`/v1/chat/completions`, `/v1/models`)
- **Anthropic Compatibility**: Exposes Junie AI as an Anthropic-compatible API (`/v1/messages`)
- **Claude Code Integration**: Launch Claude Code with Junie as its backend via `--claude-code` flag
- **Multiple Auth Methods**: JetBrains OAuth device flow or direct API key
- **Rate Limiting**: Control API usage with `--rate-limit` and `--wait` options

## Prerequisites

- [Bun](https://bun.sh/) (>= 1.2.x)
- JetBrains account with Junie subscription

## Installation

```sh
bun install
```

## Authentication

### Option 1: JetBrains OAuth (Interactive)

```sh
bun run start
# or
bun run ./src/main.ts start
```

This will start the OAuth device flow. Visit the URL shown and enter the code.

### Option 2: API Key

Get your API key from [junie.jetbrains.com/cli](https://junie.jetbrains.com/cli), then:

```sh
bun run ./src/main.ts start --auth-token YOUR_API_KEY
```

### Auth Only (no server)

```sh
bun run ./src/main.ts auth
```

## Usage

### Start the server

```sh
# Basic
bun run ./src/main.ts start

# Custom port with verbose logging
bun run ./src/main.ts start --port 8080 --verbose

# With rate limiting (30s between requests)
bun run ./src/main.ts start --rate-limit 30 --wait

# With Claude Code integration
bun run ./src/main.ts start --claude-code
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /v1/chat/completions` | POST | OpenAI-compatible chat completions |
| `GET /v1/models` | GET | List available models |
| `POST /v1/messages` | POST | Anthropic-compatible messages |

### Using with Claude Code

```sh
bun run ./src/main.ts start --claude-code
```

Or manually configure `.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:4141",
    "ANTHROPIC_AUTH_TOKEN": "dummy",
    "ANTHROPIC_MODEL": "google/gemini-2.5-pro",
    "ANTHROPIC_SMALL_FAST_MODEL": "google/gemini-2.5-flash",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

## Command Line Options

### Start Command

| Option | Description | Default | Alias |
|--------|-------------|---------|-------|
| --port | Port to listen on | 4141 | -p |
| --verbose | Enable verbose logging | false | -v |
| --auth-token | Provide auth token directly | none | -a |
| --show-token | Show tokens on fetch/refresh | false | |
| --rate-limit | Rate limit in seconds | none | -r |
| --wait | Wait instead of error on rate limit | false | -w |
| --claude-code | Generate Claude Code launch command | false | -c |

### Auth Command

| Option | Description | Default | Alias |
|--------|-------------|---------|-------|
| --verbose | Enable verbose logging | false | -v |
| --show-token | Show tokens during auth | false | |

## Architecture

This proxy follows the same architecture as [copilot-api](https://github.com/ericc-ch/copilot-api):

1. **Auth**: JetBrains OAuth device flow or API key → obtain access token
2. **Proxy**: Receive OpenAI/Anthropic format requests → forward to Grazie API (`api.jetbrains.ai`)
3. **Translation**: Anthropic requests are translated to OpenAI format before forwarding, responses are translated back

## License

MIT
