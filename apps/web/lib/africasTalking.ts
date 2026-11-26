import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

const AT_API_KEY = process.env.AT_API_KEY ?? "";
const AT_USERNAME = process.env.AT_USERNAME ?? "sandbox";
const AT_BASE = "https://api.africastalking.com";

export function normalizePhoneNumber(input: string) {
  const digits = input.replace(/[^\d+]/g, "").trim();
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("27")) return `+${digits}`;
  if (digits.startsWith("0")) return `+27${digits.slice(1)}`;
  return `+27${digits}`;
}

export async function sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
  if (!redis) {
    return { success: false, error: "OTP storage is not configured." };
  }

  if (!AT_API_KEY) {
    return { success: false, error: "Africa's Talking is not configured." };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = createHash("sha256").update(otp).digest("hex");

  try {
    await redis.setex(`otp:${phone}`, 600, hashed);
  } catch {
    return { success: false, error: "OTP storage failed." };
  }

  const body = new URLSearchParams({
    username: AT_USERNAME,
    to: phone,
    message: `Your SCHOOL verification code is: ${otp}. Valid for 10 minutes.`,
    from: "SCHOOL",
  });

  try {
    const response = await fetch(`${AT_BASE}/version1/messaging`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        apiKey: AT_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      return { success: false, error: "SMS delivery failed" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  if (!redis) return false;

  let stored: string | null = null;
  try {
    stored = await redis.get(`otp:${phone}`);
  } catch {
    return false;
  }

  if (!stored) return false;

  const hashed = createHash("sha256").update(otp).digest("hex");
  const valid = stored === hashed;

  if (valid) {
    try {
      await redis.del(`otp:${phone}`);
    } catch {
      return true;
    }
  }

  return valid;
}
