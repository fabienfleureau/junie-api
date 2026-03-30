/** Redact sensitive header values for logging */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted = { ...headers }
  if (redacted["Authorization"]) {
    const val = redacted["Authorization"]
    const spaceIdx = val.indexOf(" ")
    redacted["Authorization"] = spaceIdx >= 0
      ? `${val.slice(0, spaceIdx)} ${val.slice(spaceIdx + 1, spaceIdx + 8)}...`
      : "***"
  }
  return redacted
}
