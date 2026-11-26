import { z } from "zod";

export const LibraryContentTypeSchema = z.enum([
  "article",
  "book",
  "journal",
  "publication",
  "past_paper",
  "video_lesson",
]);

export const LibraryGradeBandSchema = z.enum([
  "foundation",
  "intermediate",
  "senior",
  "fet",
  "university",
  "all",
]);

export const LibraryResourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  content_type: LibraryContentTypeSchema,
  subject: z.string().nullable(),
  grade_band: LibraryGradeBandSchema.nullable(),
  topic_tags: z.array(z.string()),
  author: z.string().nullable(),
  publisher: z.string().nullable(),
  published_year: z.number().nullable(),
  language: z.string(),
  access_type: z.enum(["free", "premium", "subscription"]),
  thumbnail_url: z.string().nullable(),
  resource_url: z.string().nullable(),
  file_type: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export type LibraryResource = z.infer<typeof LibraryResourceSchema>;
export type LibraryContentType = z.infer<typeof LibraryContentTypeSchema>;
export type LibraryGradeBand = z.infer<typeof LibraryGradeBandSchema>;
