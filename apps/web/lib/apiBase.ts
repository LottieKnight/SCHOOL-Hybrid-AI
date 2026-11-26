const rawBase =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "";

function getBrowserApiBase() {
  if (typeof window === "undefined") {
    return "";
  }

  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return rawBase || `${window.location.protocol}//${hostname}:4000`;
  }

  // In deployed environments prefer the same-origin Next.js rewrite path
  // so auth/session cookies and CSP stay aligned with the current app host.
  return "/api";
}

export const API_BASE = getBrowserApiBase() || rawBase || "/api";
export const API_OFFLINE_MESSAGE =
  "Unable to connect to the SCHOOL server. If you're on campus, check your WiFi or data connection. Our Railway backend might be waking up.";

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return API_OFFLINE_MESSAGE;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};
