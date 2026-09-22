export function logEvent(event: string, fields: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ event, ...fields, timestamp: new Date().toISOString() }));
}

export function logFailure(event: string, error: unknown, fields: Record<string, unknown> = {}) {
  const code = (error as { code?: unknown } | null)?.code;
  console.error(JSON.stringify({
    event,
    ...fields,
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(typeof code === "string" && /^[A-Z0-9_]{1,20}$/.test(code) ? { errorCode: code } : {}),
    timestamp: new Date().toISOString(),
  }));
}
