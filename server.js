"use strict";

import { buildApp } from "./src/app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.PORT ?? "8000");
const HOST = "0.0.0.0";

let appInstance;
let shuttingDown = false;

async function start() {
  appInstance = await buildApp();
  try {
    await appInstance.listen({ port: PORT, host: HOST });
    appInstance.log.info(`Skiiyo API running on http://${HOST}:${PORT}`);
    appInstance.log.info(`Environment: ${process.env.NODE_ENV}`);
  } catch (err) {
    appInstance.log.error(err);
    process.exit(1);
  }
}

// ─── Graceful shutdown ────────────────────────────────────
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!appInstance) {
    process.exit(0);
    return;
  }

  appInstance.log.info(`${signal} received, shutting down gracefully...`);
  try {
    await appInstance.close();
    appInstance.log.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    appInstance.log.error(err, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
