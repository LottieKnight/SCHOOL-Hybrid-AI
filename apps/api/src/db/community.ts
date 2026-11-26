import { pool } from "./pool.js";
import { creditWallet } from "./wallet.js";

// Community data layer over the migration-055 schema (posts, comments,
// post_reactions). Authors are ALWAYS projected as their public handle
// (user_profiles.username) + casual avatar — never email or real name.

export const POST_TYPES = ["general", "question", "resource", "announcement"] as const;
export const REACTION_TYPES = [
  "got_it",
  "same_question",
  "great_explanation",
  "saving_this",
  "exam_relevant",
] as const;
export type PostType = (typeof POST_TYPES)[number];
export type ReactionType = (typeof REACTION_TYPES)[number];

export type FeedAuthor = { username: string | null; avatar: unknown };
export type FeedPost = {
  id: string;
  content: string;
  post_type: string;
  audience: string;
  module_code: string | null;
  image_urls: string[];
  created_at: string;
  author: FeedAuthor;
  comment_count: number;
  reaction_count: number;
  viewer_reacted: boolean;
};

export type FeedComment = {
  id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  author: FeedAuthor;
};

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}
function decodeCursor(cursor: string | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

const AUTHOR_JOIN = "JOIN user_profiles up ON up.user_id = p.user_id";

/** The public handle for a user, or null if they have not claimed one. */
export async function getUserHandle(userId: string): Promise<string | null> {
  const result = await pool.query("SELECT username FROM user_profiles WHERE user_id = $1", [userId]);
  const row = result.rows[0] as { username: string | null } | undefined;
  return row?.username ?? null;
}

export async function listFeed(params: {
  viewerId: string;
  limit: number;
  cursor?: string;
  moduleCode?: string;
}): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const { viewerId, limit } = params;
  const cur = decodeCursor(params.cursor);
  const values: unknown[] = [viewerId];
  const conditions = ["p.is_hidden = FALSE", "p.audience IN ('campus','public')"];

  if (params.moduleCode) {
    values.push(params.moduleCode);
    conditions.push(`p.module_code = $${values.length}`);
  }
  if (cur) {
    values.push(cur.createdAt, cur.id);
    conditions.push(`(p.created_at < $${values.length - 1} OR (p.created_at = $${values.length - 1} AND p.id < $${values.length}))`);
  }
  values.push(limit + 1);

  const result = await pool.query(
    `SELECT p.id, p.content, p.post_type, p.audience, p.module_code, p.image_urls,
            to_char(p.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at, p.created_at AS created_raw,
            up.username AS author_username, up.avatar_casual AS author_avatar,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_hidden = FALSE)::int AS comment_count,
            (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id)::int AS reaction_count,
            EXISTS(SELECT 1 FROM post_reactions r2 WHERE r2.post_id = p.id AND r2.user_id = $1) AS viewer_reacted
       FROM posts p ${AUTHOR_JOIN}
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${values.length}`,
    values
  );

  const rows = result.rows as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(String(last.created_raw instanceof Date ? (last.created_raw as Date).toISOString() : last.created_raw), String(last.id)) : null;

  return {
    posts: page.map((r) => ({
      id: String(r.id),
      content: String(r.content),
      post_type: String(r.post_type),
      audience: String(r.audience),
      module_code: (r.module_code as string) ?? null,
      image_urls: (r.image_urls as string[]) ?? [],
      created_at: String(r.created_at),
      author: { username: (r.author_username as string) ?? null, avatar: r.author_avatar ?? {} },
      comment_count: Number(r.comment_count),
      reaction_count: Number(r.reaction_count),
      viewer_reacted: Boolean(r.viewer_reacted),
    })),
    nextCursor,
  };
}

export async function createPost(params: {
  userId: string;
  content: string;
  postType: PostType;
  audience?: string;
  moduleCode?: string | null;
}): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO posts (user_id, content, post_type, audience, module_code)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [params.userId, params.content, params.postType, params.audience ?? "campus", params.moduleCode ?? null]
  );
  return { id: String((result.rows[0] as { id: string }).id) };
}

export async function getPost(postId: string, viewerId: string): Promise<FeedPost | null> {
  const result = await pool.query(
    `SELECT p.id, p.content, p.post_type, p.audience, p.module_code, p.image_urls,
            to_char(p.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            up.username AS author_username, up.avatar_casual AS author_avatar,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_hidden = FALSE)::int AS comment_count,
            (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id)::int AS reaction_count,
            EXISTS(SELECT 1 FROM post_reactions r2 WHERE r2.post_id = p.id AND r2.user_id = $2) AS viewer_reacted
       FROM posts p ${AUTHOR_JOIN}
      WHERE p.id = $1 AND p.is_hidden = FALSE`,
    [postId, viewerId]
  );
  const r = result.rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    content: String(r.content),
    post_type: String(r.post_type),
    audience: String(r.audience),
    module_code: (r.module_code as string) ?? null,
    image_urls: (r.image_urls as string[]) ?? [],
    created_at: String(r.created_at),
    author: { username: (r.author_username as string) ?? null, avatar: r.author_avatar ?? {} },
    comment_count: Number(r.comment_count),
    reaction_count: Number(r.reaction_count),
    viewer_reacted: Boolean(r.viewer_reacted),
  };
}

export async function listComments(postId: string): Promise<FeedComment[]> {
  const result = await pool.query(
    `SELECT c.id, c.content, c.parent_comment_id,
            to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            up.username AS author_username, up.avatar_casual AS author_avatar
       FROM comments c ${"JOIN user_profiles up ON up.user_id = c.user_id"}
      WHERE c.post_id = $1 AND c.is_hidden = FALSE
      ORDER BY c.created_at ASC`,
    [postId]
  );
  return (result.rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    content: String(r.content),
    parent_comment_id: (r.parent_comment_id as string) ?? null,
    created_at: String(r.created_at),
    author: { username: (r.author_username as string) ?? null, avatar: r.author_avatar ?? {} },
  }));
}

export async function addComment(params: {
  userId: string;
  postId: string;
  content: string;
  parentCommentId?: string | null;
}): Promise<{ id: string }> {
  const result = await pool.query(
    `INSERT INTO comments (post_id, user_id, content, parent_comment_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [params.postId, params.userId, params.content, params.parentCommentId ?? null]
  );
  return { id: String((result.rows[0] as { id: string }).id) };
}

/** Toggle a reaction: adds it if absent, removes it if present. Returns the new state. */
export async function toggleReaction(params: {
  userId: string;
  postId: string;
  reactionType: ReactionType;
}): Promise<{ reacted: boolean; count: number }> {
  const existing = await pool.query(
    "SELECT id FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction_type = $3",
    [params.postId, params.userId, params.reactionType]
  );
  if ((existing.rowCount ?? 0) > 0) {
    await pool.query("DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction_type = $3", [
      params.postId,
      params.userId,
      params.reactionType,
    ]);
  } else {
    await pool.query(
      "INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [params.postId, params.userId, params.reactionType]
    );
  }
  const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM post_reactions WHERE post_id = $1", [
    params.postId,
  ]);
  const reactedResult = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2) AS reacted",
    [params.postId, params.userId]
  );
  return {
    reacted: Boolean((reactedResult.rows[0] as { reacted: boolean }).reacted),
    count: Number((countResult.rows[0] as { count: number }).count),
  };
}

export async function postExists(postId: string): Promise<boolean> {
  const r = await pool.query("SELECT 1 FROM posts WHERE id = $1 AND is_hidden = FALSE", [postId]);
  return (r.rowCount ?? 0) > 0;
}

// --- Accepted answers + Scholar Credit award ---------------------------------
// `accepted_answer_id` already exists on `posts` (migration 055, with a FK to
// `comments.id`). These helpers wire the behaviour: when the question author
// accepts a comment as the answer, the answer's author receives 20 Scholar
// Credits. The award goes through the existing wallet ledger (`creditWallet`),
// which is idempotency-keyed, so the credit event doubles as a replay-safe
// proof-of-progress record queryable via
// `wallet_ledger_entries(ref_type='community:accepted_answer')`.

export const ACCEPTED_ANSWER_CREDITS = 20;

export type AcceptAnswerResult =
  | { ok: true; awarded_credits: number; answer_author_id: string }
  | { ok: false; reason: "post_not_found" | "comment_not_on_post" | "not_authorized" };

export async function acceptAnswer(params: {
  questionPostId: string;
  commentId: string;
  voterId: string;
}): Promise<AcceptAnswerResult> {
  const check = await pool.query(
    `SELECT p.user_id AS question_author_id, c.user_id AS answer_author_id
       FROM posts p
       JOIN comments c ON c.id = $2 AND c.post_id = p.id AND c.is_hidden = FALSE
      WHERE p.id = $1 AND p.is_hidden = FALSE`,
    [params.questionPostId, params.commentId]
  );
  const row = check.rows[0] as
    | { question_author_id: string; answer_author_id: string }
    | undefined;
  if (!row) {
    const post = await pool.query(
      "SELECT 1 FROM posts WHERE id = $1 AND is_hidden = FALSE",
      [params.questionPostId]
    );
    if (post.rowCount === 0) return { ok: false, reason: "post_not_found" };
    return { ok: false, reason: "comment_not_on_post" };
  }
  if (String(row.question_author_id) !== params.voterId) {
    return { ok: false, reason: "not_authorized" };
  }
  const answerAuthorId = String(row.answer_author_id);
  await pool.query(
    "UPDATE posts SET accepted_answer_id = $1, updated_at = NOW() WHERE id = $2 AND accepted_answer_id IS DISTINCT FROM $1",
    [params.commentId, params.questionPostId]
  );
  await creditWallet({
    userId: answerAuthorId,
    amountCredits: ACCEPTED_ANSWER_CREDITS,
    reason: "community_accepted_answer",
    refType: "community:accepted_answer",
    refId: params.commentId,
    idempotencyKey: `community:accepted_answer:${params.commentId}`,
  });
  return { ok: true, awarded_credits: ACCEPTED_ANSWER_CREDITS, answer_author_id: answerAuthorId };
}
