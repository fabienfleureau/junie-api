import { JETBRAINS_OAUTH } from "~/lib/api-config.js"

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(JETBRAINS_OAUTH.deviceAuthorizationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      scope: JETBRAINS_OAUTH.scopes,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to request device code: ${response.status} ${text}`)
  }

  return response.json()
}
