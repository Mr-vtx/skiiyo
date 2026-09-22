"use strict";

import Fastify from "fastify";
import mongoose from "mongoose";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";

import { connectDB } from "./config/dbConfig.js";
import { connectRedis, getRedis, isRedisConnected } from "./config/redis.js";
import { initGeoIP } from "./config/geoip.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { resolveProject } from "./middleware/project.js";
import { ensureDefaultProject } from "./bootstrap/defaultProject.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "HH:MM:ss" },
            }
          : undefined,
      level: process.env.NODE_ENV === "development" ? "debug" : "info",
    },
    trustProxy: true, // needed for GeoIP + rate limit behind proxy
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, 
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = process.env.ALLOWED_ORIGINS?.split(",") || [];

      if (!origin || allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, 
    },
  });

  await connectDB();
  await ensureDefaultProject(app.log);
  await connectRedis();
  await initGeoIP();

  app.get("/health", async (request, reply) => {
    const dbState = mongoose.connection.readyState;
    const dbConnected = dbState === 1; // 1 = connected

    let redisConnected = false;
    if (isRedisConnected()) {
      try {
        await getRedis().ping();
        redisConnected = true;
      } catch {
        redisConnected = false;
      }
    }

    // DB is a hard dependency; Redis degrades gracefully (see cache helpers).
    const healthy = dbConnected;

    const body = {
      status: healthy ? "ok" : "unhealthy",
      uptime: process.uptime(),
      timestamp: Date.now(),
      app: process.env.APP_NAME,
      env: process.env.NODE_ENV,
      services: {
        db: dbConnected ? "connected" : "disconnected",
        redis: redisConnected ? "connected" : "unavailable",
      },
    };

    return reply.code(healthy ? 200 : 503).send(body);
  });

  app.register(
    async (api) => {
      api.addHook("onRequest", resolveProject);

      await api.register(rateLimit, {
        max: parseInt(process.env.RATE_LIMIT_MAX ?? "100"),
        timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW ?? "60000"),
        keyGenerator: (req) => `${req.project?._id ?? "unscoped"}:${req.ip}`,
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: "Too Many Requests",
          message: "Slow down — you're sending too many requests",
        }),
      });

      api.register(authRoutes, { prefix: "/auth" });
      api.register(userRoutes, { prefix: "/user" });
      api.register(adminRoutes, { prefix: "/admin" });
    },
    { prefix: "/api/v1" },
  );

  app.setErrorHandler(errorHandler);

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return app;
}
