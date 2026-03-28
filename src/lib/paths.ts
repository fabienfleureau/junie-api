import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const APP_DIR = join(homedir(), ".local", "share", "junie-api")

export const paths = {
  appDir: APP_DIR,
  authToken: join(APP_DIR, "auth_token"),
  refreshToken: join(APP_DIR, "refresh_token"),
} as const

export function ensureAppDir(): void {
  if (!existsSync(APP_DIR)) {
    mkdirSync(APP_DIR, { recursive: true })
  }
}

export function readTokenFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8").trim()
  } catch {
    return undefined
  }
}

export function writeTokenFile(path: string, token: string): void {
  ensureAppDir()
  writeFileSync(path, token, { mode: 0o600 })
}
