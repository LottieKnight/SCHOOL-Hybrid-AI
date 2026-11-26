import { FastifyInstance } from "fastify";
import { pool } from "../db/pool.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    let dbStatus = "ok";
    try {
      await pool.query("SELECT 1");
    } catch {
      dbStatus = "unavailable";
    }

    reply.send({
      status: "ok",
      db: dbStatus,
      uptime: process.uptime(),
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    });
  });
}
