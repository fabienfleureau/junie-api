export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined
}
