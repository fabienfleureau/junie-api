import { basename } from "node:path"

type ShellType = "bash" | "zsh" | "fish" | "powershell" | "cmd" | "unknown"

function detectShell(): ShellType {
  const shell = process.env.SHELL
  if (!shell) return "unknown"

  const name = basename(shell)
  if (name === "bash") return "bash"
  if (name === "zsh") return "zsh"
  if (name === "fish") return "fish"
  if (name === "pwsh" || name === "powershell") return "powershell"
  return "unknown"
}

export function generateExportCommands(env: Record<string, string>): string {
  const shell = detectShell()

  return Object.entries(env)
    .map(([key, value]) => {
      switch (shell) {
        case "fish":
          return `set -x ${key} "${value}"`
        case "powershell":
          return `$env:${key} = "${value}"`
        case "cmd":
          return `set ${key}=${value}`
        default:
          return `export ${key}="${value}"`
      }
    })
    .join("\n")
}
