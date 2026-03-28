import { GRAZIE_API, getGrazieHeaders } from "~/lib/api-config.js"
import { state } from "~/lib/state.js"
import invariant from "tiny-invariant"

export interface ModelsResponse {
  object: "list"
  data: Array<{
    id: string
    object: "model"
    created: number
    owned_by: string
  }>
}

export async function getModels(): Promise<ModelsResponse> {
  const token = state.grazieToken ?? state.authToken
  invariant(token, "No authentication token available")

  const url = `${GRAZIE_API.baseUrl}${GRAZIE_API.modelsPath}`

  const response = await fetch(url, {
    headers: getGrazieHeaders(token),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to get models: ${response.status} ${text}`)
  }

  return response.json()
}
