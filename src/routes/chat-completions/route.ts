import { Hono } from "hono"
import { handleCompletion } from "./handler.js"

export const completionRoutes = new Hono()

completionRoutes.post("/", handleCompletion)
