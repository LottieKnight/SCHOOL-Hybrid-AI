const patterns = [
  /\bwhats?app\b/i,
  /\bcall me\b/i,
  /\bpay me directly\b/i,
  /\bcash\b/i,
  /\beft\b/i,
  /\bbank details\b/i,
  /\bmeet outside\b/i,
  /\boutside the app\b/i,
  /\bemail me\b/i,
  /\bmy email\b/i,
  /\bmy number\b/i,
  /\bcontact me\b/i,
  /\btelegram\b/i,
  /\bsignal\b/i,
  /\bphone\b/i,
  /\bmobile\b/i,
];

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /\b(\+27|0)(\d{2})\s?\d{3}\s?\d{4}\b/;

export function detectOffPlatform(text: string) {
  const hits = patterns.filter((pattern) => pattern.test(text)).length;
  const hasEmail = emailPattern.test(text);
  const hasPhone = phonePattern.test(text);
  const flagged = hits > 0 || hasEmail || hasPhone;
  const severity = hasPhone || hasEmail ? "high" : hits >= 2 ? "medium" : "low";
  const redacted = text
    .replace(emailPattern, "[redacted]")
    .replace(phonePattern, "[redacted]")
    .replace(/\bwhats?app\b/gi, "[redacted]")
    .replace(/\bpay me directly\b/gi, "[redacted]")
    .replace(/\bbank details\b/gi, "[redacted]");

  return {
    flagged,
    severity,
    redacted: flagged ? redacted : text,
    matches: {
      hasEmail,
      hasPhone,
      hitCount: hits,
    },
  };
}
