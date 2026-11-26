import { randomInt } from "node:crypto";
import { redis } from "../cache.js";

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const MAX_ATTEMPTS = 5;

function otpKey(userId: string): string {
  return `phone_otp:${userId}`;
}

function attemptsKey(userId: string): string {
  return `phone_otp_attempts:${userId}`;
}

export async function issueOtp(userId: string): Promise<string> {
  const code = String(randomInt(100000, 999999));
  await redis.set(otpKey(userId), code, "EX", OTP_TTL_SECONDS);
  // Reset attempt counter when a new OTP is issued.
  await redis.del(attemptsKey(userId));
  return code;
}

export async function verifyOtp(userId: string, code: string): Promise<"ok" | "invalid" | "expired" | "locked"> {
  const attempts = Number(await redis.incr(attemptsKey(userId)));
  if (attempts === 1) {
    // Set TTL on the attempts counter the first time it's incremented.
    await redis.expire(attemptsKey(userId), OTP_TTL_SECONDS);
  }
  if (attempts > MAX_ATTEMPTS) {
    return "locked";
  }

  const stored = await redis.get(otpKey(userId));
  if (!stored) return "expired";
  if (stored !== code.trim()) return "invalid";

  // OTP is valid — consume it.
  await redis.del(otpKey(userId));
  await redis.del(attemptsKey(userId));
  return "ok";
}
