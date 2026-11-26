import type { Queue } from "bullmq";

declare module "fastify" {
  interface FastifyInstance {
    brandQueue: Queue;
  }
}
