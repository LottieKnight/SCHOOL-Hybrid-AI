import { Resend } from "resend";
import { config } from "../config.js";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!config.resendApiKey) return null;
  if (!resend) resend = new Resend(config.resendApiKey);
  return resend;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const client = getResend();
  if (!client) return;

  const year = new Date().getFullYear();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e5e5e5; }
    .wrap { max-width: 560px; margin: 40px auto; padding: 0 16px; }
    .card { background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px; }
    .logo { font-size: 13px; font-weight: 800; letter-spacing: 0.1em; color: #a3a3a3; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 12px; color: #fafafa; line-height: 1.3; }
    p { font-size: 14px; line-height: 1.65; color: #a3a3a3; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 24px; background: #fafafa; color: #0a0a0a; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 8px; margin: 8px 0 20px; }
    .divider { border: none; border-top: 1px solid #2a2a2a; margin: 24px 0; }
    .footer { font-size: 11px; color: #525252; text-align: center; margin-top: 20px; }
    .url { font-size: 12px; color: #525252; word-break: break-all; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo">SCHOOL</div>
      <h1>Reset your password</h1>
      <p>We received a request to reset the password for your account. Click the button below to set a new password. This link expires in <strong style="color:#fafafa">1 hour</strong>.</p>
      <a href="${resetUrl}" class="btn">Reset password</a>
      <hr class="divider" />
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p class="url">${resetUrl}</p>
      <p style="margin-top:16px">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
    </div>
    <div class="footer">
      &copy; ${year} SCHOOL &mdash; <a href="${config.appUrl}" style="color:#525252">school.ac.za</a>
    </div>
  </div>
</body>
</html>`;

  try {
    await client.emails.send({
      from: config.emailFrom,
      to,
      subject: "Reset your SCHOOL password",
      html,
    });
  } catch {
    // Email is non-critical — never throw
  }
}
