import { FastifyInstance } from "fastify";
import { z } from "zod";
import { listBooks, findBooksByIds } from "../db/books.js";
import { createOrderWithItems } from "../db/orders.js";
import { requireAuth } from "../middleware/auth.js";

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        bookId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
      })
    )
    .min(1),
});

export async function registerCatalogRoutes(app: FastifyInstance) {
  app.get("/catalog/books", async (_request, reply) => {
    const books = await listBooks();
    reply.header("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    reply.send({ books });
  });

  app.post("/catalog/checkout", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const bookIds = parsed.data.items.map((item) => item.bookId);
    const books = await findBooksByIds(bookIds);
    if (books.length !== bookIds.length) {
      reply.code(404).send({ error: "One or more books not found" });
      return;
    }

    const order = await createOrderWithItems(request.user.sub, parsed.data.items, books);
    reply.code(201).send(order);
  });
}
