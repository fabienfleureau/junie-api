import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

import { completionRoutes } from "./routes/chat-completions/route.js"
import { messageRoutes } from "./routes/messages/route.js"
import { modelRoutes } from "./routes/models/route.js"

export const server = new Hono()

server.use(logger())
server.use(cors())

server.get("/", (c) => c.text("Junie API Proxy - Running"))

// OpenAI compatible endpoints
server.route("/chat/completions", completionRoutes)
server.route("/models", modelRoutes)

// With /v1/ prefix for compatibility
server.route("/v1/chat/completions", completionRoutes)
server.route("/v1/models", modelRoutes)

// Anthropic compatible endpoints
server.route("/v1/messages", messageRoutes)
