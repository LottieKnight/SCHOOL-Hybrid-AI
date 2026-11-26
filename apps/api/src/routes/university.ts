import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  getUniversityLesson,
  listUniversityLessons,
} from "../db/university-lessons.js";

const getLessonQuerySchema = z.object({
  institution: z.string().trim().min(1).max(200),
  faculty: z.string().trim().min(1).max(200),
  course: z.string().trim().min(1).max(200),
  yearOfStudy: z.coerce.number().int().min(1).max(8),
  moduleCode: z.string().trim().min(1).max(20),
});

const listLessonsQuerySchema = z.object({
  institution: z.string().trim().min(1).max(200).optional(),
  moduleCode: z.string().trim().min(1).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export async function registerUniversityRoutes(app: FastifyInstance) {
  app.get("/university/lessons", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = getLessonQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const record = await getUniversityLesson({
      institution: d.institution,
      faculty: d.faculty,
      course: d.course,
      yearOfStudy: d.yearOfStudy,
      moduleCode: d.moduleCode,
    });
    if (!record) {
      reply.code(404).send({ error: "Lesson not found" });
      return;
    }
    reply.send({
      ok: true,
      lesson: record.lesson_json,
      meta: {
        id: record.id,
        moduleCode: record.module_code,
        moduleName: record.module_name,
        generatedAt: record.generated_at,
        modelUsed: record.model_used,
      },
    });
  });

  app.get("/university/lessons/list", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = listLessonsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const records = await listUniversityLessons({
      institution: d.institution,
      moduleCode: d.moduleCode,
      limit: d.limit,
      offset: d.offset,
    });
    reply.send({
      ok: true,
      lessons: records.map((r) => ({
        id: r.id,
        institution: r.institution,
        faculty: r.faculty,
        course: r.course,
        yearOfStudy: r.year_of_study,
        moduleCode: r.module_code,
        moduleName: r.module_name,
        title: (r.lesson_json as any)?.title ?? null,
        generatedAt: r.generated_at,
      })),
      total: records.length,
    });
  });
}
