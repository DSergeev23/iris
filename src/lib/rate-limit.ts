type RateLimitEntry = { count: number; resetAt: number };

const attempts = new Map<string, RateLimitEntry>();

function consumeFixedWindowAttempt(key: string, maxAttempts: number, windowMs: number) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= maxAttempts) return false;
  current.count += 1;
  return true;
}

export function consumeLoginAttempt(key: string) {
  return consumeFixedWindowAttempt(`login:${key}`, 10, 15 * 60 * 1000);
}

export function consumeUploadPresignAttempt(adminUserId: string) {
  return consumeFixedWindowAttempt(`upload-presign:${adminUserId}`, 60, 15 * 60 * 1000);
}

export function consumeSetupAttempt(key: string) {
  return consumeFixedWindowAttempt(`admin-setup:${key}`, 8, 15 * 60 * 1000);
}

export function clearLoginAttempts(key: string) {
  attempts.delete(`login:${key}`);
}
