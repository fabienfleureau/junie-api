import { JETBRAINS_OAUTH } from "~/lib/api-config.js"

export interface JetBrainsUser {
  sub: string
  name?: string
  email?: string
}

export async function getJetBrainsUser(accessToken: string): Promise<JetBrainsUser> {
  const response = await fetch(JETBRAINS_OAUTH.userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status}`)
  }

  return response.json()
}
