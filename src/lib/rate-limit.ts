type RateLimitEntry = { count: number; resetAt: number };

const attempts = new Map<string, RateLimitEntry>();

export function consumeLoginAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }

  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

export function clearLoginAttempts(key: string) {
  attempts.delete(key);
}
