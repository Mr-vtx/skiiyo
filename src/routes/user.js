"use strict";

import { userController } from "../controllers/userController.js";
import { authenticate } from "../middleware/auth.js";

export default async function userRoutes(app) {
  app.addHook("preHandler", authenticate);

  app.get("/profile", userController.getProfile);

  app.patch(
    "/profile",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            username: { type: "string", minLength: 4, maxLength: 30 },
            bio: { type: "string", maxLength: 200, nullable: true },
            dateOfBirth: { type: "string", nullable: true },
            city: { type: "string", nullable: true },
            lat: { type: "number", nullable: true },
            lng: { type: "number", nullable: true },
          },
          additionalProperties: false,
        },
      },
    },
    userController.updateProfile,
  );

  app.patch(
    "/settings",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
        },
      },
    },
    userController.updateSettings,
  );

  // multipart body — no JSON schema, size limit is enforced globally by
  // the @fastify/multipart config in app.js
  app.post("/avatar", userController.uploadAvatar);

  app.get("/notifications", userController.getNotifications);
  app.patch("/notifications/read", userController.markRead);
  app.delete("/notifications/:id", userController.deleteNotification);

  app.post(
    "/fcm-token",
    {
      schema: {
        body: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    userController.registerFCMToken,
  );
}
