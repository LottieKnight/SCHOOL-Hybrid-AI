import "server-only";

import type { AcademicState } from "@/lib/server/userProfileState";
import { getUserAppPreferences, patchUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";
import {
  CAMPUS_LIFE_ROOM_DEFINITIONS,
  emptyReactionCounts,
  getCommunityRoomDisplayName,
  isCampusLifeRoom,
  type CommunityComment,
  type CommunityExamCountdown,
  type CommunityPost,
  type CommunityQuestionFilter,
  type CommunityRoomListItem,
  type CommunityReactionCounts,
  type CommunityReactionType,
  type CommunityRoomView,
  type RelatedQuestion,
} from "@/lib/communityShared";
import { queryPlannerDb, withPlannerDbClient } from "@/lib/server/plannerDb";
import { createNotification } from "@/lib/server/notifications";
import { renderMarkdown } from "@/lib/markdown";

type ModuleRoomRow = {
  id: string;
  module_code: string;
  module_name: string;
  pinned_post_id: string | null;
};

type PostRow = {
  id: string;
  user_id: string;
  module_code: string | null;
  content: string;
  post_type: "general" | "question" | "resource" | "announcement" | "poll";
  audience: "campus" | "faculty" | "module" | "public";
  image_urls: string[] | null;
  attachment_url: string | null;
  accepted_answer_id: string | null;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type ReactionRow = {
  post_id: string;
  reaction_type: CommunityReactionType;
  count: number;
};

type UserReactionRow = {
  post_id: string;
  reaction_type: CommunityReactionType;
};

type CountRow = {
  total: number;
};

type CommunityRoomListRow = {
  module_code: string;
  module_name: string;
  post_count: number;
};

type AcceptAnswerInput = {
  userId: string;
  postId: string;
  commentId: string;
};

type CreateCommunityPostInput = {
  userId: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionShortName: string | null;
  faculty: string | null;
  moduleCode: string;
  moduleName?: string | null;
  content: string;
  postType: "general" | "question" | "resource" | "poll";
  pollOptions?: string[];
  isAnonymous?: boolean;
};

type AcceptAnswerResult =
  | { success: true; creditsAwarded: number; alreadyAwarded: boolean }
  | { success: false; status: number; error: string };

type CreateCommunityPostResult =
  | { success: true; post: CommunityPost }
  | { success: false; status: number; error: string };

type CreateCommunityCommentInput = {
  userId: string;
  faculty: string | null;
  postId: string;
  content: string;
};

type CreateCommunityCommentResult =
  | { success: true; comment: CommunityComment }
  | { success: false; status: number; error: string };

type ToggleCommunityReactionInput = {
  userId: string;
  postId: string;
  reactionType: CommunityReactionType;
};

type ToggleCommunityReactionResult =
  | { success: true; active: boolean }
  | { success: false; status: number; error: string };

const TABLE_CACHE_TTL_MS = 30000;

type TableCache = {
  checkedAt: number;
  available: boolean;
};

let communityTableCache: TableCache = {
  checkedAt: 0,
  available: false,
};

let isAnonymousColumnEnsured = false;

async function ensureIsAnonymousColumn(): Promise<void> {
  if (isAnonymousColumnEnsured) return;
  try {
    const hasTable = await tableExists("public.posts");
    if (!hasTable) return;
    await queryPlannerDb(
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE`
    );
    isAnonymousColumnEnsured = true;
  } catch {
    // Will retry on next request
  }
}

function normalizeModuleCode(value: string) {
  return value.trim().toUpperCase();
}

function buildModuleName(moduleCode: string) {
  return getCommunityRoomDisplayName(moduleCode);
}

function buildStarterRooms(academicState: AcademicState) {
  const subjects = [...academicState.selectedSubjects, ...academicState.modulePlan.map((module) => module.code)]
    .map((subject) => normalizeModuleCode(subject))
    .filter(Boolean);

  const starterCodes = Array.from(
    new Set([
      ...subjects,
      ...(academicState.studyType === "university" ? CAMPUS_LIFE_ROOM_DEFINITIONS.map((entry) => entry.code) : []),
      "EKIP212",
      "EKRP211",
      "MACROECONOMICS",
    ])
  ).slice(0, 6);

  return starterCodes.map<CommunityRoomListItem>((moduleCode) => ({
    moduleCode,
    moduleName: buildModuleName(moduleCode),
    postCount: null,
    hasLiveData: false,
    isStarter: true,
    isCampusLife: isCampusLifeRoom(moduleCode),
  }));
}

async function tableExists(tableName: string) {
  const result = await queryPlannerDb<{ regclass: string | null }>(
    `SELECT to_regclass($1) AS regclass`,
    [tableName]
  );
  return Boolean(result.rows[0]?.regclass);
}

async function communityTablesAvailable() {
  const now = Date.now();
  if (now - communityTableCache.checkedAt < TABLE_CACHE_TTL_MS) {
    return communityTableCache.available;
  }

  try {
    const result = await queryPlannerDb<{
      posts: string | null;
      comments: string | null;
      post_reactions: string | null;
      module_rooms: string | null;
    }>(
      `
        SELECT
          to_regclass('public.posts')::text AS posts,
          to_regclass('public.comments')::text AS comments,
          to_regclass('public.post_reactions')::text AS post_reactions,
          to_regclass('public.module_rooms')::text AS module_rooms
      `
    );

    const row = result.rows[0];
    communityTableCache = {
      checkedAt: now,
      available: Boolean(row?.posts && row?.comments && row?.post_reactions && row?.module_rooms),
    };
  } catch {
    communityTableCache = {
      checkedAt: now,
      available: false,
    };
  }

  return communityTableCache.available;
}

function buildAuthorMap(
  currentUserId: string,
  posts: PostRow[],
  comments: CommentRow[],
  profiles: Map<string, { username: string | null; avatar_uniform: unknown }>
) {
  const map = new Map<string, { name: string; role: string; username: string | null; avatar: unknown }>();
  let anonymousIndex = 1;

  for (const userId of new Set([...posts.map((post) => post.user_id), ...comments.map((comment) => comment.user_id)])) {
    if (!userId) continue;
    const profile = profiles.get(userId);
    const username = profile?.username ?? null;
    if (userId === currentUserId) {
      map.set(userId, { name: "You", role: "Current student", username, avatar: profile?.avatar_uniform ?? null });
      continue;
    }

    map.set(userId, {
      name: username ? `@${username}` : `Student ${anonymousIndex}`,
      role: "Community member",
      username,
      avatar: profile?.avatar_uniform ?? null,
    });
    anonymousIndex += 1;
  }

  return map;
}

function buildReactionMap(rows: ReactionRow[]) {
  const map = new Map<string, CommunityReactionCounts>();
  for (const row of rows) {
    if (!map.has(row.post_id)) {
      map.set(row.post_id, emptyReactionCounts());
    }
    const counts = map.get(row.post_id)!;
    counts[row.reaction_type] = Number(row.count ?? 0);
  }
  return map;
}

function buildUserReactionMap(rows: UserReactionRow[]) {
  const map = new Map<string, CommunityReactionType[]>();
  for (const row of rows) {
    const existing = map.get(row.post_id) ?? [];
    if (!existing.includes(row.reaction_type)) {
      existing.push(row.reaction_type);
    }
    map.set(row.post_id, existing);
  }
  return map;
}

async function mapCommunityPosts(input: {
  currentUserId: string;
  posts: PostRow[];
  moduleFallback?: string | null;
  topContributorMap?: Map<string, 1 | 2 | 3>;
}) {
  if (input.posts.length === 0) {
    return [];
  }

  const postIds = input.posts.map((post) => post.id);
  const [commentsResult, reactionsResult, userReactionsResult] = await Promise.all([
    queryPlannerDb<CommentRow>(
      `
        SELECT id::text, post_id::text, user_id::text, content, created_at::text
        FROM comments
        WHERE is_hidden = FALSE
          AND post_id = ANY($1::uuid[])
        ORDER BY created_at ASC
      `,
      [postIds]
    ),
    queryPlannerDb<ReactionRow>(
      `
        SELECT post_id::text, reaction_type, COUNT(*)::int AS count
        FROM post_reactions
        WHERE post_id = ANY($1::uuid[])
        GROUP BY post_id, reaction_type
      `,
      [postIds]
    ),
    input.currentUserId
      ? queryPlannerDb<UserReactionRow>(
          `
            SELECT post_id::text, reaction_type
            FROM post_reactions
            WHERE post_id = ANY($1::uuid[])
              AND user_id = $2
          `,
          [postIds, input.currentUserId]
        )
      : Promise.resolve({ rows: [] as UserReactionRow[] }),
  ]);

  const comments = commentsResult.rows;
  const commentIds = comments.map((c) => c.id);
  const authorIds = new Set<string>([
    ...input.posts.map((p) => p.user_id),
    ...comments.map((c) => c.user_id),
  ].filter(Boolean));
  const profileRows = authorIds.size
    ? await queryPlannerDb<{ user_id: string; username: string | null; avatar_uniform: unknown }>(
        `SELECT user_id::text, username, avatar_uniform FROM user_profiles WHERE user_id = ANY($1::uuid[])`,
        [Array.from(authorIds)]
      )
    : { rows: [] as { user_id: string; username: string | null; avatar_uniform: unknown }[] };
  const profiles = new Map(profileRows.rows.map((r) => [r.user_id, { username: r.username, avatar_uniform: r.avatar_uniform }]));
  const authorMap = buildAuthorMap(input.currentUserId, input.posts, comments, profiles);
  const reactionMap = buildReactionMap(reactionsResult.rows);
  const userReactionMap = buildUserReactionMap(userReactionsResult.rows);
  const commentLikeData = await getCommentLikeData(commentIds, input.currentUserId);
  const commentsByPost = new Map<string, CommunityComment[]>();

  for (const comment of comments) {
    const author = authorMap.get(comment.user_id) ?? { name: "Student", role: "Community member", username: null, avatar: null };
    if (!commentsByPost.has(comment.post_id)) {
      commentsByPost.set(comment.post_id, []);
    }
    const likes = commentLikeData.get(comment.id);
    commentsByPost.get(comment.post_id)!.push({
      id: comment.id,
      postId: comment.post_id,
      userId: comment.user_id,
      authorName: author.name,
      authorRole: author.role,
      authorUsername: author.username,
      authorAvatar: author.avatar,
      content: comment.content,
      contentHtml: renderMarkdown(comment.content),
      createdAt: comment.created_at,
      isAccepted: false,
      likeCount: likes?.count ?? 0,
      userHasLiked: likes?.liked ?? false,
    });
  }

  return input.posts.map<CommunityPost>((post) => {
    const isAnon = Boolean(post.is_anonymous);
    const author = isAnon
      ? (post.user_id === input.currentUserId
          ? { name: "You (anonymous)", role: "Current student", username: null, avatar: null }
          : { name: "Anonymous Student", role: "Community member", username: null, avatar: null })
      : (authorMap.get(post.user_id) ?? { name: "Student", role: "Community member", username: null, avatar: null });
    const mappedComments = commentsByPost.get(post.id) ?? [];
    const acceptedAnswerId = post.accepted_answer_id ?? null;
    const commentsWithAccepted = mappedComments
      .map((comment) => ({
        ...comment,
        isAccepted: comment.id === acceptedAnswerId,
      }))
      .sort((a, b) => {
        if (a.isAccepted !== b.isAccepted) return a.isAccepted ? -1 : 1;
        return b.likeCount - a.likeCount;
      });
    const reactionCounts = reactionMap.get(post.id) ?? emptyReactionCounts();
    const activeReactions = userReactionMap.get(post.id) ?? [];

    return {
      id: post.id,
      userId: post.user_id,
      authorName: author.name,
      authorRole: author.role,
      authorUsername: author.username,
      authorAvatar: author.avatar,
      moduleCode: post.module_code || input.moduleFallback || "GENERAL",
      content: post.content,
      postType: post.post_type,
      audience: post.audience,
      imageUrls: Array.isArray(post.image_urls) ? post.image_urls.filter(Boolean) : [],
      attachmentUrl: post.attachment_url,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      reactionCounts,
      activeReactions,
      comments: commentsWithAccepted,
      commentCount: commentsWithAccepted.length,
      acceptedAnswerId,
      sameQuestionCount: reactionCounts.same_question,
      topContributorRank: input.topContributorMap?.get(post.user_id) ?? null,
      pollOptions: post.post_type === "poll" ? parsePollOptions(post.content).options : null,
      pollVoteCounts: null,
      pollUserVote: null,
      pollTotalVotes: null,
      contentHtml: post.post_type !== "poll" ? renderMarkdown(post.content) : undefined,
      isAnonymous: Boolean(post.is_anonymous),
    };
  });
}

function parsePollOptions(content: string): { question: string; options: string[] } {
  try {
    const parsed = JSON.parse(content) as { question?: string; options?: string[] };
    if (typeof parsed === "object" && Array.isArray(parsed.options)) {
      return { question: parsed.question ?? "", options: parsed.options.slice(0, 4) };
    }
  } catch { /* not a poll JSON */ }
  return { question: content, options: [] };
}

function buildExamCountdown(moduleCode: string, academicState: AcademicState): CommunityExamCountdown | null {
  const now = new Date();
  const normalizedModule = normalizeModuleCode(moduleCode);
  const matches = academicState.examDates
    .map((entry) => {
      const date = new Date(entry.date);
      if (Number.isNaN(date.getTime()) || date.getTime() < now.getTime()) {
        return null;
      }
      const sameModule = entry.subject.toUpperCase().includes(normalizedModule);
      const daysRemaining = Math.ceil((date.getTime() - now.getTime()) / 86400000);
      return {
        subject: entry.subject,
        date: entry.date,
        daysRemaining,
        sameModule,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => {
      if (left.sameModule !== right.sameModule) return left.sameModule ? -1 : 1;
      return left.daysRemaining - right.daysRemaining;
    });

  if (matches.length === 0) return null;

  return {
    subject: matches[0].subject,
    date: matches[0].date,
    daysRemaining: matches[0].daysRemaining,
  };
}

async function getSharedResourceCount(moduleCode: string, institutionId: string | null) {
  try {
    const hasProductsTable = await tableExists("public.bookstore_products");
    if (!hasProductsTable) return null;

    const result = await queryPlannerDb<CountRow>(
      `
        SELECT COUNT(*)::int AS total
        FROM bookstore_products
        WHERE is_active = TRUE
          AND (
            title ILIKE $1
            OR description ILIKE $1
            OR EXISTS (
              SELECT 1
              FROM unnest(COALESCE(subjects, '{}')) AS subject
              WHERE subject ILIKE $1
            )
          )
          AND ($2::uuid IS NULL OR institution_id IS NULL OR institution_id = $2)
      `,
      [`%${moduleCode}%`, institutionId]
    );

    return Number(result.rows[0]?.total ?? 0);
  } catch {
    return null;
  }
}

export async function getCommunityRoomView(input: {
  moduleCode: string;
  userId: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionShortName: string | null;
  faculty: string | null;
  academicState: AcademicState;
}): Promise<CommunityRoomView> {
  const normalizedModule = normalizeModuleCode(input.moduleCode);
  const examCountdown = buildExamCountdown(normalizedModule, input.academicState);
  const sharedResourceCount = await getSharedResourceCount(normalizedModule, input.institutionId);
  const emptyRoom: CommunityRoomView = {
    moduleCode: normalizedModule,
    moduleName: buildModuleName(normalizedModule),
    institutionName: input.institutionName,
    institutionShortName: input.institutionShortName,
    faculty: input.faculty,
    memberCount: null,
    sharedResourceCount,
    examCountdown,
    answerRate: null,
    pinnedPost: null,
    posts: [],
    hasLiveData: false,
  };

  if (!(await communityTablesAvailable())) {
    return emptyRoom;
  }

  try {
    const roomResult = await queryPlannerDb<ModuleRoomRow>(
      `
        SELECT id::text, module_code, module_name, pinned_post_id::text
        FROM module_rooms
        WHERE module_code = $1
          AND ($2::uuid IS NULL OR institution_id = $2)
        LIMIT 1
      `,
      [normalizedModule, input.institutionId]
    );

    const room = roomResult.rows[0] ?? null;

    await ensureIsAnonymousColumn();
    const postsResult = await queryPlannerDb<PostRow>(
      `
        SELECT
          id::text,
          user_id::text,
          module_code,
          content,
          post_type,
          audience,
          image_urls,
          attachment_url,
          accepted_answer_id::text,
          created_at::text,
          updated_at::text,
          COALESCE(is_anonymous, FALSE) AS is_anonymous
        FROM posts
        WHERE is_hidden = FALSE
          AND module_code = $1
          AND ($2::uuid IS NULL OR institution_id = $2 OR institution_id IS NULL)
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [normalizedModule, input.institutionId]
    );

    const posts = postsResult.rows;
    if (posts.length === 0) {
      return {
        ...emptyRoom,
        moduleName: room?.module_name || emptyRoom.moduleName,
      };
    }

    const [memberCountResult, answerRateResult, topContributorMap] = await Promise.all([
      queryPlannerDb<CountRow>(
        `
          WITH community_members AS (
            SELECT user_id
            FROM posts
            WHERE module_code = $1
              AND is_hidden = FALSE
              AND ($2::uuid IS NULL OR institution_id = $2 OR institution_id IS NULL)
            UNION
            SELECT c.user_id
            FROM comments c
            INNER JOIN posts p ON p.id = c.post_id
            WHERE p.module_code = $1
              AND c.is_hidden = FALSE
              AND p.is_hidden = FALSE
              AND ($2::uuid IS NULL OR p.institution_id = $2 OR p.institution_id IS NULL)
          )
          SELECT COUNT(*)::int AS total
          FROM community_members
        `,
        [normalizedModule, input.institutionId]
      ),
      queryPlannerDb<{ answer_rate: string }>(
        `
          SELECT
            CASE
              WHEN COUNT(*) = 0 THEN NULL
              ELSE (COUNT(CASE WHEN accepted_answer_id IS NOT NULL THEN 1 END) * 100 / COUNT(*))::text
            END AS answer_rate
          FROM posts
          WHERE post_type = 'question'
            AND is_hidden = FALSE
            AND module_code = $1
            AND ($2::uuid IS NULL OR institution_id = $2 OR institution_id IS NULL)
        `,
        [normalizedModule, input.institutionId]
      ),
      getMonthlyTopContributors(input.institutionId),
    ]);

    const answerRate = answerRateResult.rows[0]?.answer_rate != null
      ? parseInt(answerRateResult.rows[0].answer_rate, 10)
      : null;

    const mappedPosts = await mapCommunityPosts({
      currentUserId: input.userId,
      posts,
      moduleFallback: normalizedModule,
      topContributorMap,
    });

    const pinnedPost =
      (room?.pinned_post_id ? mappedPosts.find((post) => post.id === room.pinned_post_id) : null) ??
      mappedPosts.find((post) => post.postType === "announcement") ??
      null;

    return {
      moduleCode: normalizedModule,
      moduleName: room?.module_name || buildModuleName(normalizedModule),
      institutionName: input.institutionName,
      institutionShortName: input.institutionShortName,
      faculty: input.faculty,
      memberCount: Number(memberCountResult.rows[0]?.total ?? 0),
      sharedResourceCount,
      examCountdown,
      answerRate,
      pinnedPost,
      posts: mappedPosts,
      hasLiveData: true,
    };
  } catch {
    return emptyRoom;
  }
}

export async function listCommunityRooms(input: {
  institutionId: string | null;
  academicState: AcademicState;
}): Promise<CommunityRoomListItem[]> {
  const starterRooms = buildStarterRooms(input.academicState);

  if (!(await communityTablesAvailable())) {
    return starterRooms;
  }

  try {
    const result = await queryPlannerDb<CommunityRoomListRow & { last_activity_at: string | null }>(
      `
        SELECT
          mr.module_code,
          mr.module_name,
          COUNT(p.id)::int AS post_count,
          MAX(p.updated_at)::text AS last_activity_at
        FROM module_rooms mr
        LEFT JOIN posts p
          ON p.module_code = mr.module_code
         AND p.is_hidden = FALSE
         AND ($1::uuid IS NULL OR p.institution_id = $1 OR p.institution_id IS NULL)
        WHERE ($1::uuid IS NULL OR mr.institution_id = $1 OR mr.institution_id IS NULL)
        GROUP BY mr.module_code, mr.module_name
        ORDER BY mr.module_code ASC
      `,
      [input.institutionId]
    );

    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    const liveRooms = result.rows.map<CommunityRoomListItem>((row) => ({
      moduleCode: normalizeModuleCode(row.module_code),
      moduleName: row.module_name,
      postCount: Number(row.post_count ?? 0),
      hasLiveData: true,
      isStarter: false,
      isCampusLife: isCampusLifeRoom(row.module_code),
      activeNow: row.last_activity_at
        ? new Date(row.last_activity_at).getTime() > thirtyMinAgo
        : false,
    }));

    const merged = new Map<string, CommunityRoomListItem>();
    for (const room of [...liveRooms, ...starterRooms]) {
      if (!merged.has(room.moduleCode)) {
        merged.set(room.moduleCode, room);
      }
    }

    return Array.from(merged.values());
  } catch {
    return starterRooms;
  }
}

export async function listCommunityQuestions(input: {
  userId: string;
  institutionId: string | null;
  academicState: AcademicState;
  filter?: CommunityQuestionFilter;
  limit?: number;
  cursor?: string | null;
  since?: string | null;
}) {
  if (!(await communityTablesAvailable())) {
    return [];
  }

  const normalizedModules = input.academicState.selectedSubjects
    .map((subject) => normalizeModuleCode(subject))
    .filter(Boolean);
  const filter = input.filter ?? "all";
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  try {
    let whereClause = `
      WHERE p.is_hidden = FALSE
        AND p.post_type = 'question'
        AND ($1::uuid IS NULL OR p.institution_id = $1 OR p.institution_id IS NULL)
    `;
    const params: Array<string | string[] | number | null> = [input.institutionId];

    if (filter === "unanswered") {
      whereClause += " AND p.accepted_answer_id IS NULL";
    }

    if ((filter === "my-modules" || filter === "for-you") && normalizedModules.length > 0) {
      params.push(normalizedModules);
      whereClause += ` AND p.module_code = ANY($${params.length}::text[])`;
    }

    // since= param: return only posts newer than this timestamp (for live banner)
    if (input.since) {
      params.push(input.since);
      whereClause += ` AND p.created_at > $${params.length}::timestamptz`;
    }

    const orderClause =
      filter === "recent"
        ? "ORDER BY COALESCE(p.updated_at, p.created_at) DESC"
        : "ORDER BY p.created_at DESC";

    if (input.cursor) {
      params.push(input.cursor);
      const cursorCol = filter === "recent" ? "COALESCE(p.updated_at, p.created_at)" : "p.created_at";
      whereClause += ` AND ${cursorCol} < $${params.length}::timestamptz`;
    }

    params.push(limit);

    await ensureIsAnonymousColumn();
    const postsResult = await queryPlannerDb<PostRow>(
      `
        SELECT
          p.id::text,
          p.user_id::text,
          p.module_code,
          p.content,
          p.post_type,
          p.audience,
          p.image_urls,
          p.attachment_url,
          p.accepted_answer_id::text,
          p.created_at::text,
          p.updated_at::text,
          COALESCE(p.is_anonymous, FALSE) AS is_anonymous
        FROM posts p
        ${whereClause}
        ${orderClause}
        LIMIT $${params.length}
      `,
      params
    );

    return await mapCommunityPosts({
      currentUserId: input.userId,
      posts: postsResult.rows,
    });
  } catch {
    return [];
  }
}

async function ensureCommentLikesTable(): Promise<void> {
  try {
    await queryPlannerDb(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        id BIGSERIAL PRIMARY KEY,
        comment_id UUID NOT NULL,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (comment_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS comment_likes_comment_idx ON comment_likes (comment_id);
    `);
  } catch { /* ignore */ }
}

async function getCommentLikeData(
  commentIds: string[],
  currentUserId: string
): Promise<Map<string, { count: number; liked: boolean }>> {
  if (commentIds.length === 0) return new Map();
  const hasTable = await tableExists("public.comment_likes");
  if (!hasTable) return new Map();
  try {
    const [countsRes, userRes] = await Promise.all([
      queryPlannerDb<{ comment_id: string; count: string }>(
        `SELECT comment_id::text, COUNT(*)::text AS count FROM comment_likes WHERE comment_id = ANY($1::uuid[]) GROUP BY comment_id`,
        [commentIds]
      ),
      currentUserId
        ? queryPlannerDb<{ comment_id: string }>(
            `SELECT comment_id::text FROM comment_likes WHERE comment_id = ANY($1::uuid[]) AND user_id = $2`,
            [commentIds, currentUserId]
          )
        : Promise.resolve({ rows: [] as { comment_id: string }[] }),
    ]);
    const likedSet = new Set(userRes.rows.map((r) => r.comment_id));
    const map = new Map<string, { count: number; liked: boolean }>();
    for (const row of countsRes.rows) {
      map.set(row.comment_id, { count: parseInt(row.count, 10), liked: likedSet.has(row.comment_id) });
    }
    for (const commentId of likedSet) {
      if (!map.has(commentId)) map.set(commentId, { count: 1, liked: true });
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function toggleCommentLike(input: {
  commentId: string;
  userId: string;
}): Promise<{ liked: boolean; likeCount: number }> {
  if (!input.userId) return { liked: false, likeCount: 0 };
  await ensureCommentLikesTable();
  try {
    const existing = await queryPlannerDb<{ id: string }>(
      `SELECT id::text FROM comment_likes WHERE comment_id = $1 AND user_id = $2 LIMIT 1`,
      [input.commentId, input.userId]
    );
    if (existing.rows[0]) {
      await queryPlannerDb(
        `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
        [input.commentId, input.userId]
      );
    } else {
      await queryPlannerDb(
        `INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [input.commentId, input.userId]
      );
    }
    const countRes = await queryPlannerDb<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM comment_likes WHERE comment_id = $1`,
      [input.commentId]
    );
    return {
      liked: !existing.rows[0],
      likeCount: parseInt(countRes.rows[0]?.count ?? "0", 10),
    };
  } catch {
    return { liked: false, likeCount: 0 };
  }
}

async function ensurePostReportsTable(): Promise<void> {
  try {
    await queryPlannerDb(`
      CREATE TABLE IF NOT EXISTS post_reports (
        id BIGSERIAL PRIMARY KEY,
        post_id UUID NOT NULL,
        user_id UUID NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (post_id, user_id)
      )
    `);
  } catch { /* ignore */ }
}

export async function reportPost(input: {
  postId: string;
  userId: string;
  reason: string;
}): Promise<{ success: boolean }> {
  if (!input.userId) return { success: false };
  await ensurePostReportsTable();
  try {
    await queryPlannerDb(
      `INSERT INTO post_reports (post_id, user_id, reason) VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET reason = EXCLUDED.reason`,
      [input.postId, input.userId, input.reason.slice(0, 200)]
    );
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function ensurePollVotesTable(): Promise<void> {
  try {
    await queryPlannerDb(
      `CREATE TABLE IF NOT EXISTS poll_votes (
        id BIGSERIAL PRIMARY KEY,
        post_id UUID NOT NULL,
        user_id UUID NOT NULL,
        option_index INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (post_id, user_id)
      )`,
      []
    );
  } catch { /* ignore — may already exist */ }
}

async function getPollData(postIds: string[], currentUserId: string): Promise<Map<string, {
  options: string[];
  voteCounts: number[];
  userVote: number | null;
  totalVotes: number;
}>> {
  const pollPostIds = postIds;
  if (pollPostIds.length === 0) return new Map();
  const hasPollVotes = await tableExists("public.poll_votes");
  if (!hasPollVotes) return new Map();
  try {
    const [countsResult, userVoteResult] = await Promise.all([
      queryPlannerDb<{ post_id: string; option_index: string; vote_count: string }>(
        `SELECT post_id::text, option_index::text, COUNT(*)::text AS vote_count
         FROM poll_votes WHERE post_id = ANY($1::uuid[])
         GROUP BY post_id, option_index`,
        [pollPostIds]
      ),
      currentUserId
        ? queryPlannerDb<{ post_id: string; option_index: string }>(
            `SELECT post_id::text, option_index::text
             FROM poll_votes WHERE post_id = ANY($1::uuid[]) AND user_id = $2`,
            [pollPostIds, currentUserId]
          )
        : Promise.resolve({ rows: [] as { post_id: string; option_index: string }[] }),
    ]);

    const userVoteMap = new Map<string, number>();
    for (const row of userVoteResult.rows) {
      userVoteMap.set(row.post_id, parseInt(row.option_index, 10));
    }

    const voteMap = new Map<string, number[]>();
    for (const row of countsResult.rows) {
      if (!voteMap.has(row.post_id)) voteMap.set(row.post_id, []);
      const arr = voteMap.get(row.post_id)!;
      arr[parseInt(row.option_index, 10)] = parseInt(row.vote_count, 10);
    }

    return new Map();
  } catch {
    return new Map();
  }
}

export async function castPollVote(input: {
  postId: string;
  userId: string;
  optionIndex: number;
}): Promise<{ success: boolean; error?: string }> {
  if (!input.userId) return { success: false, error: "Unauthorized." };
  await ensurePollVotesTable();
  try {
    await queryPlannerDb(
      `INSERT INTO poll_votes (post_id, user_id, option_index)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET option_index = EXCLUDED.option_index`,
      [input.postId, input.userId, input.optionIndex]
    );
    return { success: true };
  } catch {
    return { success: false, error: "Unable to record vote." };
  }
}

export async function getPollResults(postId: string, currentUserId: string): Promise<{
  voteCounts: number[];
  userVote: number | null;
  totalVotes: number;
} | null> {
  const hasPollVotes = await tableExists("public.poll_votes");
  if (!hasPollVotes) return null;
  try {
    const [countsResult, userVoteResult] = await Promise.all([
      queryPlannerDb<{ option_index: string; vote_count: string }>(
        `SELECT option_index::text, COUNT(*)::text AS vote_count FROM poll_votes WHERE post_id = $1 GROUP BY option_index`,
        [postId]
      ),
      currentUserId
        ? queryPlannerDb<{ option_index: string }>(
            `SELECT option_index::text FROM poll_votes WHERE post_id = $1 AND user_id = $2 LIMIT 1`,
            [postId, currentUserId]
          )
        : Promise.resolve({ rows: [] as { option_index: string }[] }),
    ]);
    const voteCounts: number[] = [];
    let totalVotes = 0;
    for (const row of countsResult.rows) {
      const idx = parseInt(row.option_index, 10);
      const count = parseInt(row.vote_count, 10);
      voteCounts[idx] = count;
      totalVotes += count;
    }
    const userVote = userVoteResult.rows[0]?.option_index != null
      ? parseInt(userVoteResult.rows[0].option_index, 10)
      : null;
    return { voteCounts, userVote, totalVotes };
  } catch {
    return null;
  }
}

async function getMonthlyTopContributors(institutionId: string | null): Promise<Map<string, 1 | 2 | 3>> {
  const hasLedger = await tableExists("public.wallet_ledger_entries");
  if (!hasLedger) return new Map();
  try {
    const result = await queryPlannerDb<{ user_id: string }>(
      `
        SELECT user_id::text
        FROM wallet_ledger_entries
        WHERE ref_type IN ('community_post_created', 'community_comment_posted', 'community_comment_accepted', 'community_reaction_on_post')
          AND created_at >= date_trunc('month', NOW())
        GROUP BY user_id
        ORDER BY SUM(amount_credits) DESC
        LIMIT 3
      `,
      []
    );
    const map = new Map<string, 1 | 2 | 3>();
    result.rows.forEach((row, i) => {
      if (i === 0) map.set(row.user_id, 1);
      else if (i === 1) map.set(row.user_id, 2);
      else if (i === 2) map.set(row.user_id, 3);
    });
    return map;
  } catch {
    return new Map();
  }
}

async function awardCommunityCredits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  opts: { userId: string; amount: number; reason: string; refType: string; refId: string; idempotencyKey: string }
): Promise<void> {
  const existing = await client.query(
    `SELECT id::text FROM wallet_ledger_entries WHERE idempotency_key = $1 LIMIT 1`,
    [opts.idempotencyKey]
  );
  if (existing.rows[0]) return;

  await client.query(
    `INSERT INTO wallet_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [opts.userId]
  );
  await client.query(
    `UPDATE wallet_accounts SET balance_credits = balance_credits + $2 WHERE user_id = $1`,
    [opts.userId, opts.amount]
  );
  await client.query(
    `INSERT INTO wallet_ledger_entries (user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key)
     VALUES ($1, 'CREDIT', $2, $3, $4, $5, $6)`,
    [opts.userId, opts.amount, opts.reason, opts.refType, opts.refId, opts.idempotencyKey]
  );
}

async function incrementCommunityStreak(userId: string): Promise<number> {
  try {
    const prefs = await getUserAppPreferences(userId);
    const streakData = (prefs.communityStreak ?? {}) as Record<string, unknown>;
    const current = typeof streakData.current === "number" ? streakData.current : 0;
    const longest = typeof streakData.longest === "number" ? streakData.longest : 0;
    const lastActiveDate = typeof streakData.lastActiveDate === "string" ? streakData.lastActiveDate : null;

    const today = new Date().toISOString().slice(0, 10);
    if (lastActiveDate === today) return current;

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const newCurrent = lastActiveDate === yesterday ? current + 1 : 1;
    const newLongest = Math.max(longest, newCurrent);

    await patchUserAppPreferences(userId, {
      communityStreak: { current: newCurrent, longest: newLongest, lastActiveDate: today },
    });
    return newCurrent;
  } catch {
    return 0;
  }
}

async function awardCommunityAchievement(
  userId: string,
  opts: { category: string; title: string; description: string }
): Promise<boolean> {
  try {
    const existing = await queryPlannerDb<{ id: string }>(
      `SELECT id::text FROM achievements WHERE user_id = $1 AND title = $2 LIMIT 1`,
      [userId, opts.title]
    );
    if (existing.rows[0]) return false;

    await queryPlannerDb(
      `INSERT INTO achievements (user_id, category, title, description, achieved_on) VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
      [userId, opts.category, opts.title, opts.description]
    );
    return true;
  } catch {
    return false;
  }
}

export async function listSavedPosts(userId: string): Promise<CommunityPost[]> {
  if (!userId || !(await communityTablesAvailable())) return [];

  try {
    await ensureIsAnonymousColumn();
    const postsResult = await queryPlannerDb<PostRow>(
      `
        SELECT
          p.id::text, p.user_id::text, p.module_code, p.content,
          p.post_type, p.audience, p.image_urls, p.attachment_url,
          p.accepted_answer_id::text, p.created_at::text, p.updated_at::text,
          COALESCE(p.is_anonymous, FALSE) AS is_anonymous
        FROM posts p
        INNER JOIN post_reactions pr ON pr.post_id = p.id
        WHERE pr.user_id = $1
          AND pr.reaction_type = 'saving_this'
          AND p.is_hidden = FALSE
        ORDER BY pr.created_at DESC
        LIMIT 40
      `,
      [userId]
    );
    return mapCommunityPosts({ currentUserId: userId, posts: postsResult.rows });
  } catch {
    return [];
  }
}

export async function getRelatedQuestions(input: {
  moduleCode: string;
  excludePostId?: string | null;
  currentUserId: string;
}): Promise<RelatedQuestion[]> {
  if (!(await communityTablesAvailable())) return [];
  const normalizedModule = normalizeModuleCode(input.moduleCode);
  try {
    const result = await queryPlannerDb<{
      id: string; content: string; module_code: string;
      same_q: string; comment_count: string; accepted_answer_id: string | null;
    }>(
      `
        SELECT
          p.id::text,
          p.content,
          p.module_code,
          COALESCE(SUM(CASE WHEN pr.reaction_type = 'same_question' THEN 1 ELSE 0 END), 0)::text AS same_q,
          COUNT(DISTINCT c.id)::text AS comment_count,
          p.accepted_answer_id::text
        FROM posts p
        LEFT JOIN post_reactions pr ON pr.post_id = p.id
        LEFT JOIN comments c ON c.post_id = p.id AND c.is_hidden = FALSE
        WHERE p.module_code = $1
          AND p.post_type = 'question'
          AND p.is_hidden = FALSE
          AND ($2::uuid IS NULL OR p.id != $2)
        GROUP BY p.id
        ORDER BY same_q DESC, comment_count DESC, p.created_at DESC
        LIMIT 5
      `,
      [normalizedModule, input.excludePostId ?? null]
    );
    return result.rows.map((row) => ({
      id: row.id,
      content: row.content.slice(0, 120),
      moduleCode: row.module_code ?? normalizedModule,
      sameQuestionCount: parseInt(row.same_q, 10),
      commentCount: parseInt(row.comment_count, 10),
      acceptedAnswerId: row.accepted_answer_id,
    }));
  } catch {
    return [];
  }
}

export type LeaderboardEntry = {
  rank: number;
  label: string;
  totalCredits: number;
  acceptedAnswers: number;
};

export async function getCommunityLeaderboard(institutionId: string | null): Promise<LeaderboardEntry[]> {
  if (!(await tableExists("public.wallet_ledger_entries"))) return [];
  try {
    const result = await queryPlannerDb<{ user_id: string; total_credits: string; accepted_answers: string }>(
      `
        SELECT
          wle.user_id::text,
          SUM(wle.amount_credits)::text AS total_credits,
          COUNT(CASE WHEN wle.ref_type = 'community_comment_accepted' THEN 1 END)::text AS accepted_answers
        FROM wallet_ledger_entries wle
        INNER JOIN posts p ON p.user_id != wle.user_id OR TRUE
        WHERE wle.ref_type IN (
          'community_post','community_comment','community_comment_accepted','community_reaction_on_post'
        )
          AND wle.created_at >= date_trunc('week', NOW())
        GROUP BY wle.user_id
        ORDER BY SUM(wle.amount_credits) DESC
        LIMIT 10
      `,
      []
    );
    return result.rows.map((row, i) => ({
      rank: i + 1,
      label: `Student ${row.user_id.slice(0, 6).toUpperCase()}`,
      totalCredits: parseInt(row.total_credits ?? "0", 10),
      acceptedAnswers: parseInt(row.accepted_answers ?? "0", 10),
    }));
  } catch {
    return [];
  }
}

export type TrendingPost = {
  id: string;
  moduleCode: string;
  contentPreview: string;
  recentReactions: number;
};

export async function getTrendingPosts(institutionId: string | null): Promise<TrendingPost[]> {
  if (!(await communityTablesAvailable())) return [];
  try {
    const result = await queryPlannerDb<{
      id: string; module_code: string; content: string; recent_reactions: string;
    }>(
      `
        SELECT
          p.id::text,
          p.module_code,
          p.content,
          COUNT(pr.id)::text AS recent_reactions
        FROM posts p
        INNER JOIN post_reactions pr ON pr.post_id = p.id
        WHERE pr.created_at > NOW() - INTERVAL '2 hours'
          AND p.is_hidden = FALSE
          AND ($1::uuid IS NULL OR p.institution_id = $1 OR p.institution_id IS NULL)
        GROUP BY p.id, p.module_code, p.content
        ORDER BY COUNT(pr.id) DESC
        LIMIT 3
      `,
      [institutionId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      moduleCode: row.module_code ?? "",
      contentPreview: row.content.slice(0, 100),
      recentReactions: parseInt(row.recent_reactions ?? "0", 10),
    }));
  } catch {
    return [];
  }
}

export type FeaturedQuestion = {
  id: string;
  moduleCode: string;
  content: string;
  reactionCount: number;
};

export async function getFeaturedQuestion(institutionId: string | null): Promise<FeaturedQuestion | null> {
  if (!(await communityTablesAvailable())) return null;
  try {
    const result = await queryPlannerDb<{
      id: string; module_code: string; content: string; reaction_count: string;
    }>(
      `
        SELECT
          p.id::text,
          p.module_code,
          p.content,
          COUNT(pr.id)::text AS reaction_count
        FROM posts p
        LEFT JOIN post_reactions pr ON pr.post_id = p.id
        WHERE p.post_type = 'question'
          AND p.accepted_answer_id IS NULL
          AND p.is_hidden = FALSE
          AND p.created_at > NOW() - INTERVAL '7 days'
          AND ($1::uuid IS NULL OR p.institution_id = $1 OR p.institution_id IS NULL)
        GROUP BY p.id, p.module_code, p.content
        ORDER BY COUNT(pr.id) DESC
        LIMIT 1
      `,
      [institutionId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      moduleCode: row.module_code ?? "",
      content: row.content,
      reactionCount: parseInt(row.reaction_count ?? "0", 10),
    };
  } catch {
    return null;
  }
}

export async function acceptCommunityAnswer(input: AcceptAnswerInput): Promise<AcceptAnswerResult> {
  if (!input.userId) {
    return { success: false, status: 401, error: "Unauthorized." };
  }

  if (!(await communityTablesAvailable())) {
    return { success: false, status: 409, error: "Community tables are not available yet." };
  }

  try {
    const hasWalletAccounts = await tableExists("public.wallet_accounts");
    const hasWalletLedger = await tableExists("public.wallet_ledger_entries");

    return await withPlannerDbClient(async (client) => {
      await client.query("BEGIN");

      const postResult = await client.query<{
        id: string;
        user_id: string;
        accepted_answer_id: string | null;
        module_code: string | null;
      }>(
        `
          SELECT id::text, user_id::text, accepted_answer_id::text, module_code
          FROM posts
          WHERE id = $1
          FOR UPDATE
        `,
        [input.postId]
      );

      const post = postResult.rows[0];
      if (!post) {
        await client.query("ROLLBACK");
        return { success: false, status: 404, error: "Post not found." } satisfies AcceptAnswerResult;
      }

      if (post.user_id !== input.userId) {
        await client.query("ROLLBACK");
        return { success: false, status: 403, error: "Only the question author can accept an answer." } satisfies AcceptAnswerResult;
      }

      // Exam season: 2x credits if exam is within 14 days for this module
      let isExamSeason = false;
      try {
        const prefs = await getUserAppPreferences(input.userId).catch(() => ({}));
        const academicState = readAcademicState(prefs);
        const countdown = post.module_code ? buildExamCountdown(post.module_code, academicState) : null;
        isExamSeason = countdown !== null && countdown.daysRemaining <= 14;
      } catch { /* non-critical */ }

      const commentResult = await client.query<{
        id: string;
        post_id: string;
        user_id: string;
      }>(
        `
          SELECT id::text, post_id::text, user_id::text
          FROM comments
          WHERE id = $1
          FOR UPDATE
        `,
        [input.commentId]
      );

      const comment = commentResult.rows[0];
      if (!comment || comment.post_id !== input.postId) {
        await client.query("ROLLBACK");
        return { success: false, status: 404, error: "Comment not found for this post." } satisfies AcceptAnswerResult;
      }

      await client.query(
        `
          UPDATE posts
          SET accepted_answer_id = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [input.postId, input.commentId]
      );

      // First Responder: check if this accepted comment was the first on the post
      const commentCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM comments WHERE post_id = $1`,
        [input.postId]
      );
      const isFirstResponder = parseInt(commentCountResult.rows[0]?.count ?? "0", 10) === 1;

      let alreadyAwarded = false;
      const baseCredits = isFirstResponder ? 30 : 20;
      const creditsAwarded = isExamSeason ? baseCredits * 2 : baseCredits;

      if (hasWalletAccounts && hasWalletLedger) {
        const idempotencyKey = `community-accepted:${input.commentId}`;

        const existingLedger = await client.query<{ id: string }>(
          `
            SELECT id::text
            FROM wallet_ledger_entries
            WHERE idempotency_key = $1
            LIMIT 1
          `,
          [idempotencyKey]
        );

        if (existingLedger.rows[0]) {
          alreadyAwarded = true;
        } else {
          await client.query(
            `
              INSERT INTO wallet_accounts (user_id)
              VALUES ($1)
              ON CONFLICT (user_id) DO NOTHING
            `,
            [comment.user_id]
          );

          await client.query(
            `
              UPDATE wallet_accounts
              SET balance_credits = balance_credits + $2
              WHERE user_id = $1
            `,
            [comment.user_id, creditsAwarded]
          );

          await client.query(
            `
              INSERT INTO wallet_ledger_entries (
                user_id,
                type,
                amount_credits,
                reason,
                ref_type,
                ref_id,
                idempotency_key
              )
              VALUES ($1, 'CREDIT', $2, $3, $4, $5, $6)
            `,
            [
              comment.user_id,
              creditsAwarded,
              "Accepted community answer",
              "community_comment_accepted",
              input.commentId,
              idempotencyKey,
            ]
          );
        }

        // Award Bounty if exists
        const bountyResult = await client.query<{ amount_credits: number }>(
          `SELECT amount_credits FROM knowledge_bounties WHERE post_id = $1 AND is_awarded = FALSE FOR UPDATE`,
          [input.postId]
        );

        if ((bountyResult.rowCount ?? 0) > 0) {
          const bountyAmount = bountyResult.rows[0].amount_credits;

          await client.query(
            `UPDATE wallet_accounts SET balance_credits = balance_credits + $2 WHERE user_id = $1`,
            [comment.user_id, bountyAmount]
          );

          await client.query(
            `INSERT INTO wallet_ledger_entries (user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key)
             VALUES ($1, 'CREDIT', $2, $3, 'knowledge_bounty_reward', $4, $5)`,
            [
              comment.user_id,
              bountyAmount,
              "Knowledge Bounty Reward",
              "knowledge_bounty",
              input.postId,
              `bounty-award:${input.postId}`,
            ]
          );

          await client.query(`UPDATE knowledge_bounties SET is_awarded = TRUE WHERE post_id = $1`, [input.postId]);
        }
      } else {
        alreadyAwarded = true;
      }

      await client.query("COMMIT");

      if (!alreadyAwarded) {
        const creditMsg = isExamSeason
          ? `Your answer was accepted during exam season — 2x credits! You earned ${creditsAwarded} Scholar Credits. ⚡`
          : isFirstResponder
            ? `Your answer was accepted — and you were first to respond! You earned ${creditsAwarded} Scholar Credits. 🏅`
            : `Your answer was accepted! You earned ${creditsAwarded} Scholar Credits.`;
        void createNotification({
          userId: comment.user_id,
          type: "answer_accepted",
          refId: input.postId,
          message: creditMsg,
        });

        // Count accepted answers for milestone achievements
        void (async () => {
          try {
            const acceptedCountResult = await queryPlannerDb<{ count: string }>(
              `SELECT COUNT(*)::text AS count
               FROM comments c
               INNER JOIN posts p ON p.accepted_answer_id = c.id
               WHERE c.user_id = $1`,
              [comment.user_id]
            );
            const acceptedCount = parseInt(acceptedCountResult.rows[0]?.count ?? "0", 10);

            if (acceptedCount >= 1) {
              const awarded = await awardCommunityAchievement(comment.user_id, {
                category: "community",
                title: "Problem Solver",
                description: "Had your first answer accepted by a fellow student.",
              });
              if (awarded) {
                void createNotification({
                  userId: comment.user_id,
                  type: "achievement_unlocked",
                  message: "Achievement unlocked: Problem Solver — your first answer was accepted!",
                });
              }
            }
            if (acceptedCount >= 5) {
              const awarded = await awardCommunityAchievement(comment.user_id, {
                category: "community",
                title: "Go-To Expert",
                description: "Had 5 answers accepted in the community.",
              });
              if (awarded) {
                void createNotification({
                  userId: comment.user_id,
                  type: "achievement_unlocked",
                  message: "Achievement unlocked: Go-To Expert — 5 answers accepted!",
                });
              }
            }
            if (acceptedCount >= 25) {
              const awarded = await awardCommunityAchievement(comment.user_id, {
                category: "community",
                title: "Community Pillar",
                description: "Had 25 answers accepted — a cornerstone of the community.",
              });
              if (awarded) {
                void createNotification({
                  userId: comment.user_id,
                  type: "achievement_unlocked",
                  message: "Achievement unlocked: Community Pillar — 25 accepted answers. Legendary.",
                });
              }
            }
          } catch {
            // Non-critical
          }
        })();
      }

      // Notify students who clicked "same question" that it's now resolved
      void (async () => {
        try {
          const [sameQResult, postContentResult] = await Promise.all([
            queryPlannerDb<{ user_id: string }>(
              `SELECT DISTINCT user_id::text
               FROM post_reactions
               WHERE post_id = $1
                 AND reaction_type = 'same_question'
                 AND user_id != $2`,
              [input.postId, input.userId]
            ),
            queryPlannerDb<{ content: string }>(
              `SELECT content FROM posts WHERE id = $1 LIMIT 1`,
              [input.postId]
            ),
          ]);
          const rawContent = postContentResult.rows[0]?.content ?? "";
          const preview = rawContent.slice(0, 80);
          const ellipsis = rawContent.length > 80 ? "..." : "";
          const message = `A question you had was just answered: "${preview}${ellipsis}"`;
          for (const row of sameQResult.rows) {
            void createNotification({
              userId: row.user_id,
              type: "same_question_resolved",
              refId: input.postId,
              message,
            });
          }
        } catch { /* non-critical */ }
      })();

      return {
        success: true,
        creditsAwarded,
        alreadyAwarded,
      } satisfies AcceptAnswerResult;
    });
  } catch {
    return { success: false, status: 500, error: "Unable to accept this answer right now." };
  }
}

export async function toggleCommunityReaction(
  input: ToggleCommunityReactionInput
): Promise<ToggleCommunityReactionResult> {
  if (!input.userId) {
    return { success: false, status: 401, error: "Unauthorized." };
  }

  if (!(await communityTablesAvailable())) {
    return { success: false, status: 409, error: "Community tables are not available yet." };
  }

  try {
    return await withPlannerDbClient(async (client) => {
      await client.query("BEGIN");

      const existingResult = await client.query<{ id: string }>(
        `
          SELECT id::text
          FROM post_reactions
          WHERE post_id = $1
            AND user_id = $2
            AND reaction_type = $3
          LIMIT 1
          FOR UPDATE
        `,
        [input.postId, input.userId, input.reactionType]
      );

      let active = false;
      if (existingResult.rows[0]) {
        await client.query(
          `
            DELETE FROM post_reactions
            WHERE id = $1
          `,
          [existingResult.rows[0].id]
        );
      } else {
        await client.query(
          `
            INSERT INTO post_reactions (
              post_id,
              user_id,
              reaction_type
            )
            VALUES ($1, $2, $3)
          `,
          [input.postId, input.userId, input.reactionType]
        );
        active = true;

        if (await tableExists("public.wallet_ledger_entries")) {
          const postAuthorResult = await client.query<{ user_id: string }>(
            `SELECT user_id::text FROM posts WHERE id = $1 LIMIT 1`,
            [input.postId]
          );
          const postAuthorId = postAuthorResult.rows[0]?.user_id;

          if (postAuthorId && postAuthorId !== input.userId) {
            const creditCountResult = await client.query<{ count: string }>(
              `SELECT COUNT(*)::text AS count FROM wallet_ledger_entries
               WHERE ref_type = 'community_reaction_on_post' AND ref_id = $1`,
              [input.postId]
            );
            const existingReactionCredits = parseInt(creditCountResult.rows[0]?.count ?? "0", 10);

            if (existingReactionCredits < 5) {
              await awardCommunityCredits(client, {
                userId: postAuthorId,
                amount: 1,
                reason: "Reaction received on post",
                refType: "community_reaction_on_post",
                refId: `${input.postId}:${input.userId}:${input.reactionType}`,
                idempotencyKey: `community-reaction:${input.postId}:${input.userId}:${input.reactionType}`,
              });
            }

            if (input.reactionType === "kudos") {
              // Award XP to author for receiving Kudos
              await client.query(
                `INSERT INTO user_xp_ledger (user_id, amount, action_type, metadata) VALUES ($1, $2, $3, $4)`,
                [postAuthorId, 15, "KUDOS_RECEIVED", JSON.stringify({ postId: input.postId, fromUserId: input.userId })]
              );
            }
          }
        }
      }

      await client.query("COMMIT");
      return { success: true, active } satisfies ToggleCommunityReactionResult;
    });
  } catch {
    return { success: false, status: 500, error: "Unable to update this reaction right now." };
  }
}

export async function createCommunityPost(input: CreateCommunityPostInput): Promise<CreateCommunityPostResult> {
  if (!input.userId) {
    return { success: false, status: 401, error: "Unauthorized." };
  }

  const moduleCode = normalizeModuleCode(input.moduleCode);
  const rawContent = input.content.trim();

  // For polls, serialize options into JSON content
  let content = rawContent;
  if (input.postType === "poll") {
    const options = (input.pollOptions ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 4);
    if (options.length < 2) {
      return { success: false, status: 400, error: "Polls need at least 2 options." };
    }
    content = JSON.stringify({ question: rawContent, options });
  }

  if (!moduleCode || !content) {
    return { success: false, status: 400, error: "Module code and content are required." };
  }

  if (!(await communityTablesAvailable())) {
    return { success: false, status: 409, error: "Community tables are not available yet." };
  }

  try {
    return await withPlannerDbClient(async (client) => {
      await client.query("BEGIN");

      const roomResult = await client.query<{ id: string; module_name: string }>(
        `
          SELECT id::text, module_name
          FROM module_rooms
          WHERE module_code = $1
            AND (
              ($2::uuid IS NULL AND institution_id IS NULL)
              OR institution_id = $2
            )
          LIMIT 1
          FOR UPDATE
        `,
        [moduleCode, input.institutionId]
      );

      if (!roomResult.rows[0]) {
        await client.query(
          `
            INSERT INTO module_rooms (institution_id, module_code, module_name)
            VALUES ($1, $2, $3)
          `,
          [input.institutionId, moduleCode, input.moduleName?.trim() || buildModuleName(moduleCode)]
        );
      }

      await ensureIsAnonymousColumn();
      const postResult = await client.query<PostRow>(
        `
          INSERT INTO posts (
            user_id,
            institution_id,
            module_code,
            content,
            post_type,
            audience,
            is_anonymous
          )
          VALUES ($1, $2, $3, $4, $5, 'module', $6)
          RETURNING
            id::text,
            user_id::text,
            module_code,
            content,
            post_type,
            audience,
            image_urls,
            attachment_url,
            accepted_answer_id::text,
            created_at::text,
            updated_at::text,
            COALESCE(is_anonymous, FALSE) AS is_anonymous
        `,
        [input.userId, input.institutionId, moduleCode, content, input.postType, input.isAnonymous ?? false]
      );

      const newPostId = postResult.rows[0]?.id;
      if (newPostId && (await tableExists("public.wallet_ledger_entries"))) {
        await awardCommunityCredits(client, {
          userId: input.userId,
          amount: 2,
          reason: "Community post created",
          refType: "community_post",
          refId: newPostId,
          idempotencyKey: `community-post:${newPostId}`,
        });
      }

      await client.query("COMMIT");

      const row = postResult.rows[0];

      void incrementCommunityStreak(input.userId);
      void awardCommunityAchievement(input.userId, {
        category: "community",
        title: "Campus Newcomer",
        description: "Posted your first question or update in a module room.",
      }).then((awarded) => {
        if (awarded) {
          void createNotification({
            userId: input.userId,
            type: "achievement_unlocked",
            message: "Achievement unlocked: Campus Newcomer — you posted your first community post!",
          });
        }
      });

      return {
        success: true,
        post: {
          id: row.id,
          userId: row.user_id,
          authorName: input.isAnonymous ? "You (anonymous)" : "You",
          authorRole: input.faculty || "Current student",
          authorUsername: null,
          authorAvatar: null,
          moduleCode: row.module_code || moduleCode,
          content: row.content,
          postType: row.post_type,
          audience: row.audience,
          imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [],
          attachmentUrl: row.attachment_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          reactionCounts: emptyReactionCounts(),
          activeReactions: [],
          comments: [],
          commentCount: 0,
          acceptedAnswerId: row.accepted_answer_id ?? null,
          sameQuestionCount: 0,
          isAnonymous: Boolean(row.is_anonymous),
        },
      } satisfies CreateCommunityPostResult;
    });
  } catch {
    return { success: false, status: 500, error: "Unable to create a post right now." };
  }
}

export async function createCommunityComment(
  input: CreateCommunityCommentInput
): Promise<CreateCommunityCommentResult> {
  if (!input.userId) {
    return { success: false, status: 401, error: "Unauthorized." };
  }

  const postId = input.postId.trim();
  const content = input.content.trim();
  if (!postId || !content) {
    return { success: false, status: 400, error: "Post and comment content are required." };
  }

  if (!(await communityTablesAvailable())) {
    return { success: false, status: 409, error: "Community tables are not available yet." };
  }

  try {
    return await withPlannerDbClient(async (client) => {
      await client.query("BEGIN");

      const postResult = await client.query<{ id: string; user_id: string }>(
        `
          SELECT id::text, user_id::text
          FROM posts
          WHERE id = $1
            AND is_hidden = FALSE
          LIMIT 1
          FOR UPDATE
        `,
        [postId]
      );

      if (!postResult.rows[0]) {
        await client.query("ROLLBACK");
        return { success: false, status: 404, error: "Post not found." } satisfies CreateCommunityCommentResult;
      }

      const postAuthorId = postResult.rows[0].user_id;

      const commentResult = await client.query<CommentRow>(
        `
          INSERT INTO comments (
            post_id,
            user_id,
            content
          )
          VALUES ($1, $2, $3)
          RETURNING
            id::text,
            post_id::text,
            user_id::text,
            content,
            created_at::text
        `,
        [postId, input.userId, content]
      );

      await client.query(
        `
          UPDATE posts
          SET updated_at = NOW()
          WHERE id = $1
        `,
        [postId]
      );

      const newCommentId = commentResult.rows[0]?.id;
      if (newCommentId && (await tableExists("public.wallet_ledger_entries"))) {
        await awardCommunityCredits(client, {
          userId: input.userId,
          amount: 1,
          reason: "Community reply posted",
          refType: "community_comment",
          refId: newCommentId,
          idempotencyKey: `community-comment:${newCommentId}`,
        });

        // Featured question bonus: +5 credits for answering the Question of the Day
        const featuredResult = await client.query<{ id: string }>(
          `
            SELECT p.id::text
            FROM posts p
            LEFT JOIN post_reactions pr ON pr.post_id = p.id
            WHERE p.post_type = 'question'
              AND p.accepted_answer_id IS NULL
              AND p.is_hidden = FALSE
              AND p.created_at > NOW() - INTERVAL '7 days'
            GROUP BY p.id
            ORDER BY COUNT(pr.id) DESC
            LIMIT 1
          `,
          []
        );
        if (featuredResult.rows[0]?.id === postId) {
          await awardCommunityCredits(client, {
            userId: input.userId,
            amount: 5,
            reason: "Answered Question of the Day",
            refType: "community_featured_answer",
            refId: newCommentId,
            idempotencyKey: `community-featured:${postId}:${input.userId}`,
          });
        }
      }

      await client.query("COMMIT");

      const row = commentResult.rows[0];

      void incrementCommunityStreak(input.userId);

      if (postAuthorId && postAuthorId !== input.userId) {
        const preview = input.content.trim().slice(0, 60);
        void createNotification({
          userId: postAuthorId,
          type: "comment_on_post",
          refId: postId,
          message: `Someone replied to your post: "${preview}${preview.length < input.content.trim().length ? "..." : ""}"`,
        });
      }

      return {
        success: true,
        comment: {
          id: row.id,
          postId: row.post_id,
          userId: row.user_id,
          authorName: "You",
          authorRole: input.faculty || "Current student",
          authorUsername: null,
          authorAvatar: null,
          content: row.content,
          contentHtml: renderMarkdown(row.content),
          createdAt: row.created_at,
          isAccepted: false,
          likeCount: 0,
          userHasLiked: false,
        },
      } satisfies CreateCommunityCommentResult;
    });
  } catch {
    return { success: false, status: 500, error: "Unable to post this reply right now." };
  }
}
