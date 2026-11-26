import { FastifyInstance } from "fastify";
import { z } from "zod";
import { WORK_KINDS, WORK_LAYOUTS, WORK_LICENSES } from "@saedu/shared";
import { requireAuth } from "../middleware/auth.js";
import {
  addWorkVersion,
  createWork,
  getUserIdByUsername,
  getWorkDetailBySlug,
  getWorkForOwner,
  listAuthorWorks,
  listPublishedWorks,
  publishWork,
  updateWork,
  withdrawWork,
} from "../db/press.js";

// --- Validation ------------------------------------------------------------

const slugParam = z.object({ slug: z.string().min(1).max(120) });
const idParam = z.object({ id: z.string().uuid() });
const usernameParam = z.object({ username: z.string().min(1).max(80) });

const authorSchema = z.object({
  displayName: z.string().min(1).max(160),
  userId: z.string().uuid().nullable().optional(),
  affiliation: z.string().max(200).nullable().optional(),
});

const referenceSchema = z.object({
  raw: z.string().min(1).max(2000),
  doi: z.string().max(200).nullable().optional(),
});

const workSchema = z.object({
  kind: z.enum(WORK_KINDS as unknown as [string, ...string[]]),
  layout: z.enum(WORK_LAYOUTS as unknown as [string, ...string[]]),
  title: z.string().min(1).max(300),
  abstract: z.string().max(8000).nullable().optional(),
  bodyMd: z.string().max(200_000).nullable().optional(),
  disciplineTags: z.array(z.string().min(1).max(60)).max(20).default([]),
  license: z.enum(WORK_LICENSES as unknown as [string, ...string[]]),
  authors: z.array(authorSchema).max(50).default([]),
  references: z.array(referenceSchema).max(500).optional(),
  coverUrl: z.string().url().max(2000).nullable().optional(),
  coverStorageKey: z.string().max(500).nullable().optional(),
});

const versionSchema = z.object({
  fileUrl: z.string().url().max(2000).nullable().optional(),
  storageKey: z.string().max(500).nullable().optional(),
  imageUrls: z.array(z.string().url().max(2000)).max(100).optional(),
  changelog: z.string().max(2000).nullable().optional(),
});

const feedQuery = z.object({
  layout: z.enum(WORK_LAYOUTS as unknown as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

// A work is publicly visible only once published (or curated).
const PUBLIC_STATUSES = new Set(["published", "curated"]);

export async function registerPressRoutes(app: FastifyInstance) {
  // Create a draft work.
  app.post("/press/works", { preHandler: requireAuth }, async (request, reply) => {
    const body = workSchema.safeParse(request.body ?? {});
    if (!body.success) {
      reply.code(400).send({ error: "Invalid input", details: body.error.flatten() });
      return;
    }
    const work = await createWork(request.user.sub, body.data as never);
    reply.code(201).send({ work });
  });

  // Update a draft (owner only; published works are immutable except via a new version).
  app.put("/press/works/:id", { preHandler: requireAuth }, async (request, reply) => {
    const params = idParam.safeParse(request.params);
    const body = workSchema.safeParse(request.body ?? {});
    if (!params.success || !body.success) {
      reply.code(400).send({ error: "Invalid input" });
      return;
    }
    const work = await updateWork(params.data.id, request.user.sub, body.data as never);
    if (!work) {
      reply.code(404).send({ error: "Draft not found or not editable." });
      return;
    }
    reply.send({ work });
  });

  // Attach a new version (file or gallery images).
  app.post("/press/works/:id/versions", { preHandler: requireAuth }, async (request, reply) => {
    const params = idParam.safeParse(request.params);
    const body = versionSchema.safeParse(request.body ?? {});
    if (!params.success || !body.success) {
      reply.code(400).send({ error: "Invalid input" });
      return;
    }
    const version = await addWorkVersion(params.data.id, request.user.sub, body.data);
    if (!version) {
      reply.code(404).send({ error: "Work not found." });
      return;
    }
    reply.code(201).send({ version });
  });

  // Publish a draft.
  app.post("/press/works/:id/publish", { preHandler: requireAuth }, async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid id" });
      return;
    }
    const work = await publishWork(params.data.id, request.user.sub);
    if (!work) {
      reply.code(404).send({ error: "Draft not found or already published." });
      return;
    }
    reply.send({ work });
  });

  // Withdraw a published work.
  app.post("/press/works/:id/withdraw", { preHandler: requireAuth }, async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid id" });
      return;
    }
    const work = await withdrawWork(params.data.id, request.user.sub);
    if (!work) {
      reply.code(404).send({ error: "Published work not found." });
      return;
    }
    reply.send({ work });
  });

  // Public discovery feed (recent published works; optional ?layout=gallery).
  app.get("/press/feed", async (request, reply) => {
    const query = feedQuery.safeParse(request.query ?? {});
    if (!query.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }
    const works = await listPublishedWorks({
      layout: query.data.layout as never,
      limit: query.data.limit,
      offset: query.data.offset,
    });
    reply.send({ works });
  });

  // An author's public bibliography (owner sees drafts/withdrawn too).
  app.get("/press/authors/:username/works", async (request, reply) => {
    const params = usernameParam.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid username" });
      return;
    }
    const authorId = await getUserIdByUsername(params.data.username);
    if (!authorId) {
      reply.code(404).send({ error: "Author not found." });
      return;
    }
    // Owner check: only if the viewer is authenticated and is this author.
    let viewerIsOwner = false;
    try {
      await request.jwtVerify();
      viewerIsOwner = request.user?.sub === authorId;
    } catch {
      viewerIsOwner = false;
    }
    const works = await listAuthorWorks(authorId, viewerIsOwner);
    reply.send({ works });
  });

  // A single work by slug. Drafts/withdrawn are visible to the owner only.
  app.get("/press/works/:slug", async (request, reply) => {
    const params = slugParam.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid slug" });
      return;
    }
    const detail = await getWorkDetailBySlug(params.data.slug);
    if (!detail) {
      reply.code(404).send({ error: "Work not found." });
      return;
    }
    if (!PUBLIC_STATUSES.has(detail.work.status)) {
      // Not public — allow only the owner.
      let isOwner = false;
      try {
        await request.jwtVerify();
        isOwner = request.user?.sub === detail.work.author_id;
      } catch {
        isOwner = false;
      }
      if (!isOwner) {
        reply.code(404).send({ error: "Work not found." });
        return;
      }
    }
    reply.send(detail);
  });

  // Owner: fetch a work for editing (any status).
  app.get("/press/works/:id/edit", { preHandler: requireAuth }, async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid id" });
      return;
    }
    const work = await getWorkForOwner(params.data.id, request.user.sub);
    if (!work) {
      reply.code(404).send({ error: "Work not found." });
      return;
    }
    reply.send({ work });
  });
}
