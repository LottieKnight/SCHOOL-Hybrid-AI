// Open-redirect guard for `returnUrl`-style params. Only same-origin relative
// paths are allowed; anything else falls back to a safe in-app destination.
//
// Rejected forms and why:
//   - missing / empty                -> nothing to redirect to
//   - not starting with "/"          -> could be "https://evil.com" or "evil.com"
//   - starting with "//"             -> protocol-relative URL -> external host
//   - starting with "/\" or "/%5C"   -> backslash variants some browsers
//                                       normalize to "//" -> external host
//
// Apply this at every point a returnUrl is consumed (page params AND any
// component that redirects with it) so the guard cannot be bypassed by a
// caller that forgets to sanitize.

export const DEFAULT_RETURN_URL = "/dashboard?onboarding_complete=1";

export function safeReturnUrl(
  value: string | null | undefined,
  fallback: string = DEFAULT_RETURN_URL
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\") || value.startsWith("/%5C")) {
    return fallback;
  }
  return value;
}
