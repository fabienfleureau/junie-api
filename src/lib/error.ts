export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = "HTTPError"
  }
}

export function forwardError(error: unknown): Response {
  if (error instanceof HTTPError) {
    return Response.json(
      { error: { message: error.message, type: "error", code: error.statusCode } },
      { status: error.statusCode },
    )
  }

  if (error instanceof Error) {
    return Response.json(
      { error: { message: error.message, type: "error", code: 500 } },
      { status: 500 },
    )
  }

  return Response.json(
    { error: { message: "Unknown error", type: "error", code: 500 } },
    { status: 500 },
  )
}
