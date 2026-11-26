/** Push payloads must not be able to open an off-site window. */
export function safeNotificationPath(url: unknown) {
  if (typeof url !== "string") return "/";
  const value = url.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return "/";
  }
  return value;
}
