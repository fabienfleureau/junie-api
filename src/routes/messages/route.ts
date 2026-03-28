import { Hono } from "hono"
import { handleCompletion } from "./handler.js"

export const messageRoutes = new Hono()

messageRoutes.post("/", handleCompletion)
