export function logEvent(event: string, fields: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ event, ...fields, timestamp: new Date().toISOString() }));
}
