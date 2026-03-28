import { Hono } from "hono"
import consola from "consola"
import { getModels } from "~/services/grazie/get-models.js"
import { forwardError } from "~/lib/error.js"

export const modelRoutes = new Hono()

modelRoutes.get("/", async (c) => {
  try {
    const models = await getModels()
    return c.json(models)
  } catch (error) {
    consola.error("Failed to get models:", error)
    return forwardError(error)
  }
})
