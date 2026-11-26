import { redis } from "../cache.js";

const MAX_FAILURES = 10;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

function failKey(email: string): string {
  return `login_fail:${email.toLowerCase()}`;
}

export async function isLoginLocked(email: string): Promise<boolean> {
  try {
    const count = Number(await redis.get(failKey(email)));
    return count >= MAX_FAILURES;
  } catch {
    return false;
  }
}

export async function recordLoginFailure(email: string): Promise<void> {
  try {
    const key = failKey(email);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
  } catch {
    return;
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  try {
    await redis.del(failKey(email));
  } catch {
    return;
  }
}
