import { basename } from "node:path"

type ShellType = "bash" | "zsh" | "fish" | "powershell" | "cmd" | "sh"

function detectShell(): ShellType {
  if (process.platform === "win32") {
    return "cmd"
  }

  const shell = process.env.SHELL
  if (!shell) return "sh"

  const name = basename(shell)
  if (name === "bash") return "bash"
  if (name === "zsh") return "zsh"
  if (name === "fish") return "fish"
  return "sh"
}

/**
 * Generates a copy-pasteable script to set environment variables
 * and optionally run a command afterward.
 */
export function generateEnvScript(
  envVars: Record<string, string>,
  commandToRun: string = "",
): string {
  const shell = detectShell()
  const entries = Object.entries(envVars)

  let commandBlock: string

  switch (shell) {
    case "powershell": {
      commandBlock = entries.map(([k, v]) => `$env:${k} = ${v}`).join("; ")
      break
    }
    case "cmd": {
      commandBlock = entries.map(([k, v]) => `set ${k}=${v}`).join(" & ")
      break
    }
    case "fish": {
      commandBlock = entries.map(([k, v]) => `set -gx ${k} ${v}`).join("; ")
      break
    }
    default: {
      const assignments = entries.map(([k, v]) => `${k}=${v}`).join(" ")
      commandBlock = entries.length > 0 ? `export ${assignments}` : ""
      break
    }
  }

  if (commandBlock && commandToRun) {
    const separator = shell === "cmd" ? " & " : " && "
    return `${commandBlock}${separator}${commandToRun}`
  }

  return commandBlock || commandToRun
}
