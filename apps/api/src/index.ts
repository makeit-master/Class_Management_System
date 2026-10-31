import { app } from "./app.js";
import { env } from "./config/env.js";
import { disconnectPrisma } from "./lib/prisma.js";

const server = app.listen(env.port, "127.0.0.1", () => {
  console.log(`API running at http://127.0.0.1:${env.port}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    try { await disconnectPrisma(); } catch (err) { console.error("Prisma shutdown failed", err); }
  });
}
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
