const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AUTH_EMAIL_NOT_FOUND: "No account found with this email. Want to create one?",
  AUTH_WRONG_PASSWORD: "Incorrect password. Forgot it?",
  AUTH_RATE_LIMITED: "Too many attempts. Try again in 15 minutes.",
  AUTH_EMAIL_UNVERIFIED: "Please verify your email first. Resend link?",
  AUTH_TOKEN_EXPIRED: "Your session expired. Sign in again.",
  AUTH_REFRESH_INVALID: "Your session expired. Sign in again.",
  AUTH_EMAIL_TAKEN: "Account already exists. Sign in instead?",
  AUTH_WEAK_PASSWORD: "This password is too common. Choose another.",
  AUTH_OTP_INVALID: "Incorrect code. Please try again.",
  AUTH_OTP_EXPIRED: "Code expired. Request a new one.",
  AUTH_MAGIC_LINK_EXPIRED: "Link expired. Request a new one.",
  AUTH_MAGIC_LINK_USED: "Link already used. Request a new one.",
};

const FALLBACK = "Something went wrong. Please try again.";

export function getAuthErrorMessage(code: string): string {
  return AUTH_ERROR_MESSAGES[code] ?? FALLBACK;
}
