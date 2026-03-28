import consola from "consola"
import { requestDeviceCode } from "~/services/jetbrains/device-auth.js"
import { pollForToken } from "~/services/jetbrains/poll-token.js"
import { getJetBrainsUser } from "~/services/jetbrains/get-user.js"
import { saveAuthToken, setupTokenRefresh } from "~/lib/token.js"

export async function runAuthFlow(options: {
  showToken?: boolean
}): Promise<void> {
  consola.info("Starting JetBrains authentication flow...")

  const deviceCode = await requestDeviceCode()

  consola.box(
    `Please visit: ${deviceCode.verification_uri}\n\n` +
    `Enter code: ${deviceCode.user_code}\n\n` +
    `Waiting for authorization...`,
  )

  const tokenResponse = await pollForToken(
    deviceCode.device_code,
    deviceCode.interval,
    deviceCode.expires_in,
  )

  saveAuthToken(tokenResponse.access_token, tokenResponse.refresh_token)

  if (options.showToken) {
    consola.info(`Access token: ${tokenResponse.access_token}`)
  }

  // Set up auto-refresh
  if (tokenResponse.refresh_token) {
    setupTokenRefresh(tokenResponse.expires_in)
  }

  try {
    const user = await getJetBrainsUser(tokenResponse.access_token)
    consola.success(`Authenticated as: ${user.name ?? user.email ?? user.sub}`)
  } catch {
    consola.success("Authenticated successfully")
  }
}
