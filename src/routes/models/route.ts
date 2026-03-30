import { Hono } from "hono"
import { getModels } from "~/services/grazie/get-models.js"

export const modelRoutes = new Hono()

modelRoutes.get("/", (c) => {
  return c.json(getModels())
})
