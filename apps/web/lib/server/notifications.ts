import "server-only";

import { queryPlannerDb } from "@/lib/server/plannerDb";
import { sendEmail, emailAnswerAccepted, emailSameQuestionResolved } from "@/lib/server/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://school.ditshego-ventures.co.za";

const TYPE_TITLES: Record<string, string> = {
  answer_accepted: "Answer accepted!",
  same_question_resolved: "Your question was answered",
  comment_on_post: "New reply on your post",
  reaction_on_post: "New reaction",
  achievement_unlocked: "Achievement unlocked",
  weekly_wrap: "Your weekly wrap",
  follow: "New follower",
};

export type AppNotification = {
  id: string;
  type: string;
  refId: string | null;
  message: string;
  createdAt: string;
};

type UserEmailRow = {
  email: string;
  first_name: string | null;
};

async function getUserEmail(userId: string): Promise<{ email: string; firstName: string } | null> {
  try {
    const result = await queryPlannerDb<UserEmailRow>(
      `SELECT email, first_name FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row?.email) return null;
    return { email: row.email, firstName: row.first_name ?? "" };
  } catch {
    return null;
  }
}

async function resolveNotificationLink(type: string, refId?: string): Promise<string | null> {
  if (!refId) {
    if (type === "achievement_unlocked") return "/dashboard";
    return null;
  }
  try {
    const postRow = await queryPlannerDb<{ module_code: string | null }>(
      `SELECT module_code FROM posts WHERE id = $1 LIMIT 1`,
      [refId]
    );
    const code = postRow.rows[0]?.module_code;
    return code ? `/community/rooms/${encodeURIComponent(code)}` : `/community`;
  } catch {
    return `/community`;
  }
}

export async function createNotification(opts: {
  userId: string;
  type: string;
  refId?: string;
  message: string;
}): Promise<void> {
  try {
    const link = await resolveNotificationLink(opts.type, opts.refId);
    await queryPlannerDb(
      `INSERT INTO user_notifications (user_id, title, message, link, type, is_read)
       VALUES ($1, $2, $3, $4, $5, FALSE)`,
      [opts.userId, TYPE_TITLES[opts.type] ?? "Update", opts.message, link, opts.type]
    );

    // Fire email for high-priority event types — non-blocking
    if (opts.type === "answer_accepted" || opts.type === "same_question_resolved") {
      void (async () => {
        try {
          const user = await getUserEmail(opts.userId);
          if (!user) return;

          // Resolve the module room URL so the email links somewhere real
          let refUrl = `${SITE_URL}/community`;
          if (opts.refId) {
            try {
              const postRow = await queryPlannerDb<{ module_code: string }>(
                `SELECT module_code FROM posts WHERE id = $1 LIMIT 1`,
                [opts.refId]
              );
              const code = postRow.rows[0]?.module_code;
              if (code) refUrl = `${SITE_URL}/community/rooms/${encodeURIComponent(code)}`;
            } catch { /* fall back to /community */ }
          }

          const preview = opts.message.length > 120 ? opts.message.slice(0, 120) + "…" : opts.message;

          if (opts.type === "answer_accepted") {
            const creditMatch = opts.message.match(/earned (\d+) Scholar Credits/);
            const credits = creditMatch ? parseInt(creditMatch[1], 10) : 5;
            await sendEmail(emailAnswerAccepted({ toEmail: user.email, credits, questionPreview: preview, questionUrl: refUrl }));
          } else {
            await sendEmail(emailSameQuestionResolved({ toEmail: user.email, questionPreview: preview, questionUrl: refUrl }));
          }
        } catch {
          // Non-critical
        }
      })();
    }
  } catch {
    // Notifications are non-critical — never let them break the calling flow
  }
}

export async function getUnreadNotifications(userId: string): Promise<AppNotification[]> {
  try {
    const result = await queryPlannerDb<{
      id: string;
      type: string;
      ref_id: string | null;
      message: string;
      created_at: string;
    }>(
      `SELECT id::text, type, link AS ref_id, message, created_at::text
       FROM user_notifications
       WHERE user_id = $1 AND is_read = FALSE
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    return result.rows.map((r) => ({
      id: r.id,
      type: r.type,
      refId: r.ref_id,
      message: r.message,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    await queryPlannerDb(
      `UPDATE user_notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
  } catch {
    // Non-critical
  }
}
