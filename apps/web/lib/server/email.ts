import "server-only";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "SCHOOL <notifications@school.ditshego-ventures.co.za>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://school.ditshego-ventures.co.za";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY is not set — email skipped");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      console.error("[email] Resend error:", res.status, JSON.stringify(errBody));
    } else {
      console.log("[email] sent ok subject:", payload.subject);
    }
  } catch (e) {
    console.error("[email] fetch error:", e);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const year = new Date().getFullYear();
  await sendEmail({
    to,
    subject: "Reset your SCHOOL password",
    html: baseTemplate(`
      <h1>Reset your password</h1>
      <p>We received a request to reset the password for your account. Click the button below to set a new password. This link expires in <strong style="color:#fafafa">1 hour</strong>.</p>
      <a href="${resetUrl}" class="btn">Reset password</a>
      <hr class="divider" />
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:12px;color:#525252;word-break:break-all;">${resetUrl}</p>
      <p>If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
      <p style="font-size:11px;color:#525252;margin-top:8px;">&copy; ${year} SCHOOL</p>
    `),
  });
}

function baseTemplate(body: string): string {
  return `<!DOCTYPE html>
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
    .footer a { color: #525252; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo">SCHOOL</div>
      ${body}
    </div>
    <div class="footer">
      DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL &bull; [Redacted for public repository — contact privacy@ditshego-ventures.co.za]<br/>
      <a href="${SITE_URL}/legal/privacy">Privacy Policy</a> &bull;
      <a href="${SITE_URL}/settings">Manage notifications</a>
    </div>
  </div>
</body>
</html>`;
}

export function emailAnswerAccepted(opts: {
  toEmail: string;
  credits: number;
  questionPreview: string;
  questionUrl: string;
}): EmailPayload {
  return {
    to: opts.toEmail,
    subject: "Your answer was accepted — you earned Scholar Credits",
    html: baseTemplate(`
      <h1>Your answer was accepted! ✅</h1>
      <p>Someone marked your answer to the question below as the accepted answer.</p>
      <p style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px;font-style:italic;color:#d4d4d4;">
        "${opts.questionPreview}"
      </p>
      <p>You earned <strong style="color:#fafafa;">${opts.credits} Scholar Credits</strong> for helping a classmate.</p>
      <a href="${opts.questionUrl}" class="btn">View the question →</a>
      <hr class="divider" />
      <p>Keep answering questions to climb the weekly leaderboard and unlock achievements.</p>
    `),
  };
}

export function emailSameQuestionResolved(opts: {
  toEmail: string;
  questionPreview: string;
  questionUrl: string;
}): EmailPayload {
  return {
    to: opts.toEmail,
    subject: "A question you had was just answered 💡",
    html: baseTemplate(`
      <h1>Someone answered your question 💡</h1>
      <p>You reacted "Same question" to this post, and it now has an accepted answer:</p>
      <p style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px;font-style:italic;color:#d4d4d4;">
        "${opts.questionPreview}"
      </p>
      <a href="${opts.questionUrl}" class="btn">Read the accepted answer →</a>
      <hr class="divider" />
      <p>If this helped you, pay it forward — answer an open question in your module room.</p>
    `),
  };
}

export function emailWeeklyWrap(opts: {
  toEmail: string;
  firstName: string;
  posts: number;
  comments: number;
  reactionsReceived: number;
  creditsEarned: number;
  dashboardUrl: string;
}): EmailPayload {
  const { firstName, posts, comments, reactionsReceived, creditsEarned } = opts;
  const total = posts + comments + reactionsReceived;
  const headline =
    total === 0
      ? "Your campus misses you"
      : creditsEarned >= 20
        ? "You had a great week on SCHOOL"
        : "Here's your week on SCHOOL";

  return {
    to: opts.toEmail,
    subject: `${headline} — weekly summary`,
    html: baseTemplate(`
      <h1>${headline}</h1>
      <p>Hi ${firstName || "there"}, here's what you did in the community this week:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px 8px 0 0;color:#a3a3a3;font-size:13px;">Posts created</td>
          <td style="padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-top:none;color:#fafafa;font-weight:700;text-align:right;">${posts}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-top:none;color:#a3a3a3;font-size:13px;">Answers posted</td>
          <td style="padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-top:none;color:#fafafa;font-weight:700;text-align:right;">${comments}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-top:none;color:#a3a3a3;font-size:13px;">Reactions received</td>
          <td style="padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-top:none;color:#fafafa;font-weight:700;text-align:right;">${reactionsReceived}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 0 8px;color:#a3a3a3;font-size:13px;">Scholar Credits earned</td>
          <td style="padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 8px 0;color:#fafafa;font-weight:700;text-align:right;">+${creditsEarned} 🪙</td>
        </tr>
      </table>
      ${total === 0 ? "<p>There are open questions in your module rooms waiting for someone to answer them.</p>" : "<p>Thanks for helping your classmates. Every answer you post helps someone pass.</p>"}
      <a href="${opts.dashboardUrl}" class="btn">Open SCHOOL →</a>
    `),
  };
}
