import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  POST_TYPES,
  REACTION_TYPES,
  listFeed,
  createPost,
  getPost,
  listComments,
  addComment,
  toggleReaction,
  postExists,
  acceptAnswer,
  getUserHandle,
  type PostType,
  type ReactionType,
} from "../db/community.js";

const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  module: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const createPostSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  postType: z.enum(POST_TYPES).optional(),
  audience: z.enum(["campus", "public"]).optional(),
  moduleCode: z.string().trim().max(40).optional(),
});

const commentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parentCommentId: z.string().uuid().optional(),
});

const reactionSchema = z.object({
  reactionType: z.enum(REACTION_TYPES),
});

const acceptAnswerSchema = z.object({
  commentId: z.string().uuid(),
});

/**
 * Resolve the caller's public handle, or send a 403 telling them to claim one.
 * Returns null (and replies) when no handle — callers must `return` on null.
 */
async function requireHandle(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const handle = await getUserHandle(request.user.sub);
  if (!handle) {
    reply.code(403).send({
      error: "Claim a public handle to participate in the community.",
      code: "handle_required",
    });
    return null;
  }
  return handle;
}

export async function registerCommunityRoutes(app: FastifyInstance) {
  // Feed — readable by any signed-in user (browse freely).
  app.get("/community/feed", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }
    const result = await listFeed({
      viewerId: request.user.sub,
      limit: parsed.data.limit ?? 20,
      cursor: parsed.data.cursor,
      moduleCode: parsed.data.module,
    });
    reply.send(result);
  });

  // Whether the caller can post (used by the UI to gate the composer).
  app.get("/community/me", { preHandler: requireAuth }, async (request, reply) => {
    const handle = await getUserHandle(request.user.sub);
    reply.send({ handle, canPost: Boolean(handle) });
  });

  // Create a post — requires a public handle.
  app.post("/community/posts", { preHandler: requireAuth }, async (request, reply) => {
    if (!(await requireHandle(request, reply))) return;
    const parsed = createPostSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input" });
      return;
    }
    const created = await createPost({
      userId: request.user.sub,
      content: parsed.data.content,
      postType: (parsed.data.postType ?? "general") as PostType,
      audience: parsed.data.audience ?? "campus",
      moduleCode: parsed.data.moduleCode ?? null,
    });
    const post = await getPost(created.id, request.user.sub);
    reply.code(201).send({ post });
  });

  // Single post + its comments.
  app.get("/community/posts/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const post = await getPost(id, request.user.sub);
    if (!post) {
      reply.code(404).send({ error: "Post not found" });
      return;
    }
    const comments = await listComments(id);
    reply.send({ post, comments });
  });

  // Add a comment — requires a public handle.
  app.post("/community/posts/:id/comments", { preHandler: requireAuth }, async (request, reply) => {
    if (!(await requireHandle(request, reply))) return;
    const { id } = request.params as { id: string };
    if (!(await postExists(id))) {
      reply.code(404).send({ error: "Post not found" });
      return;
    }
    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input" });
      return;
    }
    const created = await addComment({
      userId: request.user.sub,
      postId: id,
      content: parsed.data.content,
      parentCommentId: parsed.data.parentCommentId ?? null,
    });
    reply.code(201).send({ id: created.id });
  });

  // Toggle a reaction — requires a public handle.
  app.post("/community/posts/:id/reactions", { preHandler: requireAuth }, async (request, reply) => {
    if (!(await requireHandle(request, reply))) return;
    const { id } = request.params as { id: string };
    if (!(await postExists(id))) {
      reply.code(404).send({ error: "Post not found" });
      return;
    }
    const parsed = reactionSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input" });
      return;
    }
    const result = await toggleReaction({
      userId: request.user.sub,
      postId: id,
      reactionType: parsed.data.reactionType as ReactionType,
    });
    reply.send(result);
  });

  // Accept a comment as the answer on a (question) post. Only the post author
  // may accept; accepting awards the answer author 20 Scholar Credits
  // (idempotent — safe to retry). The credit ledger entry is the
  // proof-of-progress event for the milestone.
  app.post(
    "/community/posts/:id/accept",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!(await requireHandle(request, reply))) return;
      const { id } = request.params as { id: string };
      const parsed = acceptAnswerSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input" });
        return;
      }
      const result = await acceptAnswer({
        questionPostId: id,
        commentId: parsed.data.commentId,
        voterId: request.user.sub,
      });
      if (!result.ok) {
        if (result.reason === "post_not_found" || result.reason === "comment_not_on_post") {
          reply.code(404).send({ error: "Post or comment not found" });
        } else {
          reply.code(403).send({ error: "Only the post author may accept an answer", code: "not_authorized" });
        }
        return;
      }
      reply.code(200).send(result);
    }
  );
}
