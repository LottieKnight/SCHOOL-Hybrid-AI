import { config } from "../config.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (!config.resendApiKey) {
    console.error("[email] RESEND_API_KEY is not set — email not sent", { to: options.to, subject: options.subject });
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: config.emailFrom, to: options.to, subject: options.subject, html: options.html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[email] Resend API error ${res.status}: ${body}`);
  }
}

const CARD_STYLE = `background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:32px`;
const BODY_STYLE = `margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,sans-serif;color:#e5e5e5`;
const BTN_STYLE = `display:inline-block;padding:12px 24px;background:#fafafa;color:#0a0a0a;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;margin-top:20px`;
const FOOTER_STYLE = `font-size:11px;color:#525252;text-align:center;margin-top:20px`;
const LOGO = `<div style="font-size:13px;font-weight:800;letter-spacing:0.1em;color:#a3a3a3;margin-bottom:24px;">SCHOOL</div>`;

function baseLayout(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="${BODY_STYLE}"><div style="max-width:540px;margin:40px auto;padding:0 16px"><div style="${CARD_STYLE}">${LOGO}${body}</div><div style="${FOOTER_STYLE}">DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL &nbsp;·&nbsp; <a href="https://school.ditshego-ventures.co.za" style="color:inherit;text-decoration:none;">school.ditshego-ventures.co.za</a> &nbsp;·&nbsp; privacy@ditshego-ventures.co.za</div></div></body></html>`;
}

export function buildVerificationEmail(firstName: string, verifyUrl: string): { subject: string; html: string } {
  const subject = "Verify your SCHOOL email address";
  const html = baseLayout(`
    <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#fafafa">Hi ${firstName || "there"} — confirm your email</h1>
    <p style="font-size:14px;line-height:1.65;color:#a3a3a3;margin:0 0 16px">Click the button below to verify your email address. This link expires in 24 hours.</p>
    <a href="${verifyUrl}" style="${BTN_STYLE}">Verify email →</a>
    <p style="font-size:12px;color:#525252;margin-top:20px">If you didn't create a SCHOOL account, you can safely ignore this email.</p>
  `);
  return { subject, html };
}

export function buildParentalConsentEmail(minorFirstName: string, consentUrl: string): { subject: string; html: string } {
  const subject = `Parental consent required — ${minorFirstName}'s SCHOOL account`;
  const html = baseLayout(`
    <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#fafafa">Consent required for ${minorFirstName || "your child"}</h1>
    <p style="font-size:14px;line-height:1.65;color:#a3a3a3;margin:0 0 16px">${minorFirstName || "Your child"} has created a SCHOOL account — an educational platform for South African learners. As their parent or legal guardian, your consent is required under the Protection of Personal Information Act (POPIA) §35 before they can access certain features.</p>
    <p style="font-size:14px;line-height:1.65;color:#a3a3a3;margin:0 0 16px">SCHOOL is a learning platform offering study materials, past papers, and tutor matching. By clicking the button below you confirm that you consent to your child using the platform.</p>
    <a href="${consentUrl}" style="${BTN_STYLE}">Give consent →</a>
    <p style="font-size:12px;color:#525252;margin-top:20px">This link expires in 7 days. If you did not expect this email or do not consent, simply ignore it — no action is required from you and the account will remain restricted.</p>
  `);
  return { subject, html };
}

export function buildPasswordResetEmail(firstName: string, resetUrl: string): { subject: string; html: string } {
  const subject = "Reset your SCHOOL password";
  const html = baseLayout(`
    <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#fafafa">Hi ${firstName || "there"} — password reset</h1>
    <p style="font-size:14px;line-height:1.65;color:#a3a3a3;margin:0 0 16px">We received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour.</p>
    <a href="${resetUrl}" style="${BTN_STYLE}">Reset password →</a>
    <p style="font-size:12px;color:#525252;margin-top:20px">If you didn't request a password reset, you can safely ignore this email. Your account is secure.</p>
  `);
  return { subject, html };
}

export function buildDsarLodgedEmail(input: {
  requestType: "access" | "erasure";
  requestorUserId: string;
  details?: string | null;
  siteUrl?: string;
}): { subject: string; html: string } {
  const kind = input.requestType === "access" ? "§23 access (copy of data)" : "§24 erasure (delete data)";
  const subject = `New POPIA request: ${input.requestType} — ${input.requestorUserId.slice(0, 8)}`;
  const detailsBlock = input.details
    ? `<p style="font-size:14px;line-height:1.65;color:#a3a3a3;margin:0 0 16px"><strong>Subject's note:</strong> ${input.details.replace(/</g, "&lt;")}</p>`
    : "";
  const manageUrl = input.siteUrl
    ? `${input.siteUrl.replace(/\/$/, "")}/admin/data-protection`
    : "/admin/data-protection";
  const html = baseLayout(`
    <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#fafafa">A ${kind} request has been lodged</h1>
    <p style="font-size:14px;line-height:1.65;color:#a3a3a3;margin:0 0 16px">A data subject (user id <code style="font-family:monospace;color:#fafafa">${input.requestorUserId}</code>) has lodged a POPIA ${kind} request. Respond within the 30-day statutory clock.</p>
    ${detailsBlock}
    <a href="${manageUrl}" style="${BTN_STYLE}">Open the DSAR queue →</a>
  `);
  return { subject, html };
}
