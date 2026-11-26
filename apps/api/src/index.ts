import { buildServer } from "./server.js";
import { config } from "./config.js";
import { startWorker, scheduleWeeklyWrap, scheduleDataRetention } from "./queue/index.js";
import { startBrandWorkers } from "./queue/brandWorkers.js";

const app = await buildServer();

if (config.enableWorker) {
  startWorker();
  startBrandWorkers();
  void scheduleWeeklyWrap();
  void scheduleDataRetention();
}

try {
  const host = process.env.HOST || (config.isProd ? "0.0.0.0" : "127.0.0.1");
  await app.listen({ port: config.port, host });
  app.log.info(`API listening on http://${host}:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

process.on("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await app.close();
  process.exit(0);
});
